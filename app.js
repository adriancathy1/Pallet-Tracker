// Antonello Produce Pallet Tracker - vanilla JS SPA implementation
(function() {
  // Configuration
  const SUPABASE_URL = (window.supabaseConfig && window.supabaseConfig.url) || ''
  const SUPABASE_ANON_KEY = (window.supabaseConfig && window.supabaseConfig.key) || ''
  let supabaseClient = null

  // In-memory application state
  let movements = []
  let staff = []
  let customers = []
  let activeSession = null
  let isAuthenticated = false
  let selectedStaffName = ''
  let editingId = null
  let editingCustomerId = null
  let editingStaffId = null

  // Page Routing Configuration
  const routes = {
    '#/dashboard': 'page-dashboard',
    '#/log-movement': 'page-log-movement',
    '#/movements': 'page-movements',
    '#/balances': 'page-balances',
    '#/customers': 'page-customers',
    '#/staff': 'page-staff'
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    // Set movement date default to today
    const today = new Date().toISOString().slice(0, 10)
    document.getElementById('date').value = today

    bindEvents()

    // Initialize Supabase Client
    if (!initSupabaseClient()) {
      showConnectionError('Supabase Configuration Error: URL and Anon Key must be configured. Check your env variables and build the app.')
      return
    }

    // --- DIAGNOSTIC RAW FETCH TEST ---
    console.log('[Diagnostics] Supabase URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 15) + '...' : 'EMPTY');
    console.log('[Diagnostics] Supabase Anon Key length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      console.log('[Diagnostics] Performing raw fetch test to bypass Supabase library...');
      fetch(SUPABASE_URL + '/rest/v1/allowed_users?select=email', {
        headers: { 'apikey': SUPABASE_ANON_KEY }
      })
      .then(res => {
        console.log('[Diagnostics] Raw fetch response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[Diagnostics] Raw fetch successful! Data:', data);
      })
      .catch(err => {
        console.error('[Diagnostics] Raw fetch failed:', err);
      });
    }
    // ---------------------------------

    // Handle authentication state changes
    supabaseClient.auth.onAuthStateChange(handleAuthStateChange)
  })

  function initSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
    if (typeof supabase !== 'undefined' && supabase && !supabaseClient) {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    }
    return supabaseClient
  }

  // --- VIEW TRANSITIONS & ROUTER ---
  function showView(viewId) {
    const views = ['view-loading', 'view-error', 'view-login', 'view-app']
    views.forEach(v => {
      const el = document.getElementById(v)
      if (v === viewId) {
        el.classList.remove('hidden')
      } else {
        el.classList.add('hidden')
      }
    })
  }

  function handleRouting() {
    const hash = window.location.hash || '#/dashboard'

    if (!isAuthenticated) {
      showView('view-login')
      return
    }

    showView('view-app')

    const pageId = routes[hash] || 'page-dashboard'

    // Update Sidebar navigation active classes
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('href') === hash) {
        item.classList.add('active')
      } else {
        item.classList.remove('active')
      }
    })

    // Display active page block, hide others
    document.querySelectorAll('.app-page').forEach(page => {
      if (page.id === pageId) {
        page.classList.remove('hidden')
      } else {
        page.classList.add('hidden')
      }
    })

    // Set page header title
    const titles = {
      '#/dashboard': 'Dashboard',
      '#/log-movement': editingId ? 'Edit Movement' : 'Record Movement',
      '#/movements': 'Movements Log',
      '#/balances': 'Customer Balances',
      '#/customers': 'Customers Directory',
      '#/staff': 'Staff Members'
    }
    document.getElementById('page-title').textContent = titles[hash] || 'Dashboard'

    // Trigger page-specific renders
    if (hash === '#/dashboard') {
      renderDashboard()
    } else if (hash === '#/movements') {
      renderMovementsTable()
    } else if (hash === '#/balances') {
      renderBalancesTable()
    } else if (hash === '#/customers') {
      renderCustomersTable()
    } else if (hash === '#/staff') {
      renderStaffTable()
    }
  }

  // Loader Controls
  function showLoader(message = 'Loading data...') {
    document.querySelector('.loader-text').textContent = message
    document.getElementById('view-loading').classList.remove('hidden')
  }

  function hideLoader() {
    document.getElementById('view-loading').classList.add('hidden')
  }

  function showConnectionError(msg) {
    document.getElementById('error-message').textContent = msg
    showView('view-error')
  }

  // --- AUTHENTICATION FLOWS ---
  let isVerifying = false;
  let lastCheckedEmail = '';

  function handleAuthStateChange(event, session) {
    console.log(`[Auth Event] Triggered with event: "${event}", session present:`, !!session);
    // Defer the verification to the next tick of the event loop to release the SDK's auth state lock
    setTimeout(async () => {
      await processAuthStateChange(event, session);
    }, 0);
  }

  async function processAuthStateChange(event, session) {
    const email = session && session.user && session.user.email;

    // If there is no user session
    if (!session || !session.user) {
      console.log('[Auth Event] No active user session. Routing to login.');
      isAuthenticated = false;
      activeSession = null;
      isVerifying = false;
      lastCheckedEmail = '';
      showView('view-login');
      window.location.hash = '#/login';
      hideLoader();
      return;
    }

    // Deduplicate: If we are already running verification for this exact email, ignore this event
    if (isVerifying && lastCheckedEmail === email) {
      console.log(`[Auth Event] Ignoring duplicate event for "${email}" (already verifying).`);
      return;
    }

    activeSession = session;
    isVerifying = true;
    lastCheckedEmail = email;

    console.log(`[Auth Event] Starting verification process for user: "${email}"`);

    try {
      showLoader('Verifying account access...');
      const isAllowed = await checkWhitelist(email);
      console.log(`[Auth Event] Whitelist check result for "${email}":`, isAllowed);

      if (isAllowed) {
        isAuthenticated = true;
        try {
          console.log(`[Auth Event] Whitelist verified for "${email}". Syncing app database...`);
          await loadDataFromDB();
          document.getElementById('auth-alert').classList.add('hidden');
          
          const currentHash = window.location.hash;
          console.log(`[Auth Event] Database synced. Current page hash: "${currentHash}"`);
          if (!currentHash || currentHash === '#/login' || currentHash === '') {
            window.location.hash = '#/dashboard';
          } else {
            handleRouting();
          }
        } catch (err) {
          console.error('[Auth Event] Failed to load data after successful login:', err);
        }
      } else {
        console.warn(`[Auth Event] Access denied: "${email}" is not in the allowed_users table.`);
        isAuthenticated = false;
        
        console.log('[Auth Event] Attempting to sign out unwhitelisted user session...');
        try {
          await supabaseClient.auth.signOut();
          console.log('[Auth Event] Unwhitelisted session signed out successfully.');
        } catch (signOutErr) {
          console.warn('[Auth Event] Error signing out unwhitelisted session:', signOutErr);
        }

        const alertEl = document.getElementById('auth-alert');
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = `Access Denied: ${email} is not authorized to access this website.`;
        alertEl.classList.remove('hidden');
        showView('view-login');
        window.location.hash = '#/login';

        // Reset verification lock since verification is finished (denied)
        isVerifying = false;
        lastCheckedEmail = '';
      }
    } catch (err) {
      console.error('[Auth Event] Uncaught error during auth state verification:', err);
      const alertEl = document.getElementById('auth-alert');
      if (alertEl) {
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = 'Verification Error: ' + (err.message || 'An error occurred during account verification.');
        alertEl.classList.remove('hidden');
      }
      showView('view-login');
      window.location.hash = '#/login';
      
      // Reset lock
      isVerifying = false;
      lastCheckedEmail = '';
    } finally {
      console.log('[Auth Event] Hiding loading overlay.');
      hideLoader();
    }
  }

  async function checkWhitelist(email) {
    console.log(`[checkWhitelist] Initiating whitelist check for: "${email}"`);
    try {
      console.log('[checkWhitelist] Querying allowed_users table...');
      const queryPromise = supabaseClient
        .from('allowed_users')
        .select('email')
        .eq('email', email.toLowerCase());

      console.log('[checkWhitelist] Awaiting Supabase promise resolution...');
      const { data, error } = await queryPromise;
      
      console.log('[checkWhitelist] Query finished. Data:', data, 'Error:', error);

      if (error) {
        console.error('[checkWhitelist] Database error verifying whitelist:', error);
        if (error.code === '42P01') {
          alert("The whitelist table 'allowed_users' does not exist in your Supabase database. Please create it first.");
        }
        return false;
      }
      
      const isAllowed = data && data.length > 0;
      console.log(`[checkWhitelist] User "${email}" allowed status:`, isAllowed);
      return isAllowed;
    } catch (err) {
      console.error('[checkWhitelist] Failed to check email whitelist due to uncaught exception:', err);
      return false;
    }
  }

  async function onLoginSubmit(e) {
    e.preventDefault()
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value
    const alertEl = document.getElementById('auth-alert')
    alertEl.classList.add('hidden')

    showLoader('Signing in...')
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (error) {
      console.error('Login error:', error)
      alertEl.className = 'alert alert-danger'
      alertEl.textContent = 'Login Failed: ' + (error.message || 'Verify your credentials.')
      alertEl.classList.remove('hidden')
      hideLoader()
    }
  }

  async function onSignupSubmit(e) {
    e.preventDefault()
    const email = document.getElementById('signup-email').value.trim()
    const password = document.getElementById('signup-password').value
    const alertEl = document.getElementById('auth-alert')
    alertEl.classList.add('hidden')

    showLoader('Creating account...')
    try {
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      })
      if (error) throw error

      document.getElementById('signup-form').classList.add('hidden')
      document.getElementById('confirm-email-msg').classList.remove('hidden')
    } catch (error) {
      console.error('Registration error:', error)
      alertEl.className = 'alert alert-danger'
      alertEl.textContent = 'Registration Failed: ' + (error.message || 'Unknown signup error.')
      alertEl.classList.remove('hidden')
    } finally {
      hideLoader()
    }
  }

  async function onLogoutClick() {
    showLoader('Signing out...')
    try {
      await supabaseClient.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      hideLoader()
    }
  }

  // --- DATABASE-ONLY SYNCHRONIZATION ---
  async function loadDataFromDB() {
    if (!supabaseClient) return
    showLoader('Syncing with database...')
    try {
      // 1. Fetch staff roster
      const { data: staffData, error: staffErr } = await supabaseClient
        .from('staff')
        .select('*')
        .order('name', { ascending: true })
      if (staffErr) throw staffErr
      staff = staffData || []

      // 2. Fetch customers directory
      const { data: customersData, error: customersErr } = await supabaseClient
        .from('customers')
        .select('*')
        .order('name', { ascending: true })
      if (customersErr) throw customersErr
      customers = customersData || []

      // 3. Fetch movements chronological
      const { data: movementsData, error: movementsErr } = await supabaseClient
        .from('movements')
        .select('*')
        .order('recorded_at', { ascending: false })
      if (movementsErr) throw movementsErr
      
      // Map customer name from customer_id in movements
      movements = (movementsData || []).map(m => {
        const cust = customers.find(c => c.id === m.customer_id)
        return {
          ...m,
          customer: cust ? cust.name : 'Unknown Customer'
        }
      })

      // Update inputs & selects
      populateStaffSelect()
      populateFilters()
      populateCustomerDatalist()
      
      // Match active logged in operator
      matchActiveStaff()

      document.getElementById('view-error').classList.add('hidden')
    } catch (error) {
      console.error('Database sync failed:', error)
      showConnectionError('Database Connection Failed: ' + (error.message || 'Make sure you are online.'))
      throw error
    } finally {
      hideLoader()
    }
  }

  // Match logged in user's email with staff list to set active operator
  function matchActiveStaff() {
    if (!activeSession || !activeSession.user) return
    const userEmail = activeSession.user.email

    const matched = staff.find(s => s.email && s.email.toLowerCase() === userEmail.toLowerCase())
    
    document.getElementById('user-email').textContent = userEmail
    const profileRoleEl = document.getElementById('user-staff-name')
    const staffSelectEl = document.getElementById('staff-select')

    if (matched) {
      selectedStaffName = matched.name
      profileRoleEl.textContent = `Operator: ${matched.name}`
      staffSelectEl.value = matched.name
    } else {
      profileRoleEl.textContent = 'No linked staff profile'
      // Clear select if no current selection
      if (!selectedStaffName) {
        staffSelectEl.value = ''
      }
    }
  }

  // --- MUTATION HANDLERS ---
  async function onAddStaff(e) {
    e.preventDefault()
    const name = document.getElementById('new-staff-name').value.trim()
    const email = document.getElementById('new-staff-email').value.trim()

    if (!name) return alert('Enter a staff name')

    showLoader('Registering staff member in DB...')
    try {
      const { error } = await supabaseClient
        .from('staff')
        .insert({ name, email: email || null })
      if (error) throw error

      document.getElementById('staff-form').reset()
      await loadDataFromDB()
      renderStaffTable()
    } catch (error) {
      console.error('Staff creation failed:', error)
      alert('Failed to save staff member: ' + (error.message || 'Duplicate staff name or email.'))
    } finally {
      hideLoader()
    }
  }

  function startEditStaff(s) {
    editingStaffId = s.id
    document.getElementById('modal-staff-name').value = s.name
    document.getElementById('modal-staff-email').value = s.email || ''
    document.getElementById('modal-edit-staff').classList.remove('hidden')
  }

  function closeStaffModal() {
    editingStaffId = null
    document.getElementById('modal-staff-form').reset()
    document.getElementById('modal-edit-staff').classList.add('hidden')
  }

  async function onSaveStaffEdit(e) {
    e.preventDefault()
    if (!editingStaffId) return

    const name = document.getElementById('modal-staff-name').value.trim()
    const email = document.getElementById('modal-staff-email').value.trim()

    if (!name) return alert('Staff name is required')

    showLoader('Saving staff changes...')
    try {
      const { error } = await supabaseClient
        .from('staff')
        .update({ name, email: email || null })
        .eq('id', editingStaffId)
      if (error) throw error

      closeStaffModal()
      await loadDataFromDB()
      renderStaffTable()
    } catch (error) {
      console.error('Failed to save staff edit:', error)
      alert('Failed to save staff changes: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  async function onRemoveStaff(id, name) {
    if (!confirm(`Are you sure you want to remove staff member "${name}"? Existing movements recorded under this operator will remain, but they will be removed from future selection options.`)) return

    showLoader('Removing staff member from DB...')
    try {
      const { error } = await supabaseClient
        .from('staff')
        .delete()
        .eq('id', id)
      
      if (error) throw error

      // Database reload verification
      await loadDataFromDB()
      renderStaffTable()
    } catch (error) {
      console.error('Delete staff failed:', error)
      alert('Failed to remove staff: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  // --- CUSTOMER MUTATION HANDLERS ---
  async function onSubmitCustomer(e) {
    e.preventDefault()
    const name = document.getElementById('customer-name').value.trim()
    const contactPerson = document.getElementById('customer-contact').value.trim()
    const email = document.getElementById('customer-email').value.trim()
    const phone = document.getElementById('customer-phone').value.trim()
    const address = document.getElementById('customer-address').value.trim()
    const notes = document.getElementById('customer-notes').value.trim()
    const status = document.getElementById('customer-status').value

    if (!name) return alert('Enter a customer name')

    showLoader('Creating new customer in DB...')
    try {
      const customerData = {
        name,
        contact_person: contactPerson || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
        status: status || 'Active'
      }

      const { error } = await supabaseClient
        .from('customers')
        .insert(customerData)
      if (error) throw error

      document.getElementById('customer-form').reset()
      await loadDataFromDB()
      renderCustomersTable()
    } catch (error) {
      console.error('Customer creation failed:', error)
      alert('Failed to save customer: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  function startEditCustomer(c) {
    editingCustomerId = c.id
    document.getElementById('modal-customer-name').value = c.name
    document.getElementById('modal-customer-contact').value = c.contact_person || ''
    document.getElementById('modal-customer-email').value = c.email || ''
    document.getElementById('modal-customer-phone').value = c.phone || ''
    document.getElementById('modal-customer-address').value = c.address || ''
    document.getElementById('modal-customer-notes').value = c.notes || ''
    document.getElementById('modal-customer-status').value = c.status || 'Active'

    document.getElementById('modal-edit-customer').classList.remove('hidden')
  }

  function closeCustomerModal() {
    editingCustomerId = null
    document.getElementById('modal-customer-form').reset()
    document.getElementById('modal-edit-customer').classList.add('hidden')
  }

  async function onSaveCustomerEdit(e) {
    e.preventDefault()
    if (!editingCustomerId) return

    const name = document.getElementById('modal-customer-name').value.trim()
    const contactPerson = document.getElementById('modal-customer-contact').value.trim()
    const email = document.getElementById('modal-customer-email').value.trim()
    const phone = document.getElementById('modal-customer-phone').value.trim()
    const address = document.getElementById('modal-customer-address').value.trim()
    const notes = document.getElementById('modal-customer-notes').value.trim()
    const status = document.getElementById('modal-customer-status').value

    if (!name) return alert('Customer name is required')

    showLoader('Saving customer changes...')
    try {
      const { error } = await supabaseClient
        .from('customers')
        .update({
          name,
          contact_person: contactPerson || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          notes: notes || null,
          status: status || 'Active'
        })
        .eq('id', editingCustomerId)
      if (error) throw error

      closeCustomerModal()
      await loadDataFromDB()
      renderCustomersTable()
    } catch (error) {
      console.error('Failed to save customer edit:', error)
      alert('Failed to save customer changes: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  async function onDeleteCustomer(id, name) {
    const hasMovements = movements.some(m => m.customer_id === id)
    if (hasMovements) {
      alert(`Cannot delete customer "${name}" because they have historical pallet movements recorded. Consider setting their status to "Inactive" to archive them instead.`)
      return
    }

    if (!confirm(`Are you sure you want to delete customer "${name}"? This will permanently remove them from the database.`)) return

    showLoader('Deleting customer from DB...')
    try {
      const { error } = await supabaseClient
        .from('customers')
        .delete()
        .eq('id', id)
      if (error) throw error

      await loadDataFromDB()
      renderCustomersTable()
    } catch (error) {
      console.error('Delete customer failed:', error)
      alert('Failed to delete customer: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  async function onSubmitMovement(e) {
    e.preventDefault()

    const type = document.querySelector('input[name="type"]:checked').value
    const customerName = document.getElementById('customer').value.trim()
    const qty = parseInt(document.getElementById('qty').value, 10)
    const date = document.getElementById('date').value
    const note = document.getElementById('note').value.trim()

    if (!selectedStaffName) {
      return alert('An active operator must be selected from the dropdown in the header to attribute this record.')
    }
    if (!customerName) return alert('Customer name is required')
    if (isNaN(qty) || qty < 1) return alert('Quantity must be a positive integer')

    // Enforce balance checking to prevent negative balances
    if (type === 'return') {
      const currentBalance = calculateCustomerBalance(customerName)
      if (qty > currentBalance) {
        return alert(`Return quantity exceeds current outstanding balance (${currentBalance}). Transaction blocked.`)
      }
    }

    showLoader(editingId ? 'Saving updates to DB...' : 'Writing record to DB...')
    try {
      // 1. Add customer directory entry if new
      let customerId = null
      const matchedCustomer = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase())
      if (!matchedCustomer) {
        const { data: newCust, error: custErr } = await supabaseClient
          .from('customers')
          .insert({ name: customerName })
          .select()
        if (custErr) throw custErr
        if (newCust && newCust.length > 0) {
          customerId = newCust[0].id
        } else {
          throw new Error('Failed to create new customer profile.')
        }
      } else {
        customerId = matchedCustomer.id
      }

      // 2. Perform DB insert or update
      if (editingId) {
        const { error } = await supabaseClient
          .from('movements')
          .update({
            date,
            customer_id: customerId,
            type,
            qty,
            note: note || null,
            staff: selectedStaffName,
            edited_at: new Date().toISOString()
          })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabaseClient
          .from('movements')
          .insert({
            date,
            recorded_at: new Date().toISOString(),
            customer_id: customerId,
            type,
            qty,
            staff: selectedStaffName,
            note: note || null
          })
        if (error) throw error
      }

      // Reset form controls
      document.getElementById('movement-form').reset()
      document.getElementById('date').value = new Date().toISOString().slice(0, 10)
      editingId = null
      document.getElementById('submit-btn').textContent = 'Record Movement'
      document.getElementById('form-heading').textContent = 'Record Pallet Movement'
      document.getElementById('cancel-edit-btn').classList.add('hidden')

      // Reload state from database
      await loadDataFromDB()
      window.location.hash = '#/movements'
    } catch (error) {
      console.error('Movement submit failed:', error)
      alert('Failed to log movement: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  async function onDeleteMovement(id) {
    if (!confirm('Permanently delete this pallet movement record from the database? This is irreversible.')) return

    showLoader('Deleting record from DB...')
    try {
      const { error } = await supabaseClient
        .from('movements')
        .delete()
        .eq('id', id)
      
      if (error) throw error

      // Reload state from database
      await loadDataFromDB()
      renderMovementsTable()
    } catch (error) {
      console.error('Delete movement failed:', error)
      alert('Failed to delete movement record: ' + (error.message || 'Database error.'))
    } finally {
      hideLoader()
    }
  }

  function startEditMovement(m) {
    editingId = m.id
    document.getElementById('customer').value = m.customer
    document.getElementById('qty').value = m.qty
    document.getElementById('date').value = m.date
    document.getElementById('note').value = m.note || ''

    document.querySelectorAll('input[name="type"]').forEach(r => {
      r.checked = r.value === m.type
    })

    document.getElementById('submit-btn').textContent = 'Update Movement'
    document.getElementById('form-heading').textContent = 'Edit Pallet Movement'
    document.getElementById('cancel-edit-btn').classList.remove('hidden')

    window.location.hash = '#/log-movement'
  }

  function cancelEdit() {
    editingId = null
    document.getElementById('movement-form').reset()
    document.getElementById('date').value = new Date().toISOString().slice(0, 10)
    document.getElementById('submit-btn').textContent = 'Record Movement'
    document.getElementById('form-heading').textContent = 'Record Pallet Movement'
    document.getElementById('cancel-edit-btn').classList.add('hidden')
    window.location.hash = '#/movements'
  }

  // --- CALCULATIONS ---
  function calculateCustomerTotals() {
    const map = {}
    movements.forEach(m => {
      if (!map[m.customer]) map[m.customer] = { issued: 0, returned: 0 }
      if (m.type === 'issue') {
        map[m.customer].issued += m.qty
      } else {
        map[m.customer].returned += m.qty
      }
    })
    return map
  }

  function calculateCustomerBalance(customerName) {
    const totals = calculateCustomerTotals()
    const c = totals[customerName]
    return c ? c.issued - c.returned : 0
  }

  // --- UI RENDER OPERATIONS ---
  function renderDashboard() {
    const totals = calculateCustomerTotals()
    let totalIssued = 0
    let totalReturned = 0
    
    Object.values(totals).forEach(t => {
      totalIssued += t.issued
      totalReturned += t.returned
    })

    document.getElementById('total-issued').textContent = totalIssued
    document.getElementById('total-returned').textContent = totalReturned
    document.getElementById('net-outstanding').textContent = totalIssued - totalReturned
    document.getElementById('customer-count').textContent = Object.keys(totals).length

    // Render Recent Movements Log list (top 5)
    const recentTbody = document.querySelector('#recent-movements-table tbody')
    recentTbody.innerHTML = ''
    const recentMovements = movements.slice(0, 5)

    if (recentMovements.length === 0) {
      recentTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No movements on record.</td></tr>`
    } else {
      recentMovements.forEach(m => {
        const tr = document.createElement('tr')
        const badge = m.type === 'issue' ? '<span class="badge badge-issue">Issue</span>' : '<span class="badge badge-return">Return</span>'
        tr.innerHTML = `
          <td data-label="Date">${m.date}</td>
          <td data-label="Customer">${escapeHtml(m.customer)}</td>
          <td data-label="Type">${badge}</td>
          <td data-label="Qty">${m.qty}</td>
          <td data-label="Staff">${escapeHtml(m.staff)}</td>
        `
        recentTbody.appendChild(tr)
      })
    }

    // Render Outstanding Balances list (top 5)
    const topBalancesTbody = document.querySelector('#top-balances-table tbody')
    topBalancesTbody.innerHTML = ''
    const sortedBalances = Object.entries(totals)
      .map(([customer, t]) => ({ customer, balance: t.issued - t.returned }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)

    if (sortedBalances.length === 0) {
      topBalancesTbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No customers tracked.</td></tr>`
    } else {
      sortedBalances.forEach(item => {
        const tr = document.createElement('tr')
        const balanceClass = item.balance > 0 ? 'balance-positive' : (item.balance < 0 ? 'balance-negative' : 'balance-zero')
        tr.innerHTML = `
          <td data-label="Customer">${escapeHtml(item.customer)}</td>
          <td data-label="Balance" class="${balanceClass}">${item.balance}</td>
        `
        topBalancesTbody.appendChild(tr)
      })
    }
  }

  function renderMovementsTable() {
    const tbody = document.querySelector('#movements-table tbody')
    tbody.innerHTML = ''

    const filterCustomer = document.getElementById('filter-customer').value
    const filterType = document.getElementById('filter-type').value
    const filterStaff = document.getElementById('filter-staff').value

    const filtered = movements.filter(m => {
      if (filterCustomer && m.customer !== filterCustomer) return false
      if (filterType && m.type !== filterType) return false
      if (filterStaff && m.staff !== filterStaff) return false
      return true
    })

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No movements match selected filters.</td></tr>`
      return
    }

    filtered.forEach(m => {
      const tr = document.createElement('tr')
      const badge = m.type === 'issue' ? '<span class="badge badge-issue">Issue</span>' : '<span class="badge badge-return">Return</span>'
      const editIndicator = m.edited_at ? `<span class="edit-indicator" title="Edited on ${new Date(m.edited_at).toLocaleString()}">✎</span>` : ''

      tr.innerHTML = `
        <td data-label="Date">${m.date}${editIndicator}</td>
        <td data-label="Customer">${escapeHtml(m.customer)}</td>
        <td data-label="Type">${badge}</td>
        <td data-label="Qty">${m.qty}</td>
        <td data-label="Recorded By">${escapeHtml(m.staff)}</td>
        <td data-label="Notes">${escapeHtml(m.note || '')}</td>
        <td data-label="Actions">
          <div class="row-actions">
            <button class="btn secondary-btn edit-btn">Edit</button>
            <button class="btn logout-btn delete-btn">Delete</button>
          </div>
        </td>
      `
      
      tr.querySelector('.edit-btn').addEventListener('click', () => startEditMovement(m))
      tr.querySelector('.delete-btn').addEventListener('click', () => onDeleteMovement(m.id))
      
      tbody.appendChild(tr)
    })
  }

  function renderBalancesTable() {
    const tbody = document.querySelector('#balances-table tbody')
    tbody.innerHTML = ''

    const totals = calculateCustomerTotals()
    const rows = Object.entries(totals).map(([customer, t]) => ({
      customer,
      issued: t.issued,
      returned: t.returned,
      balance: t.issued - t.returned
    }))

    rows.sort((a, b) => b.balance - a.balance || a.customer.localeCompare(b.customer))

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No balances to display.</td></tr>`
      return
    }

    const maxBalance = Math.max(...rows.map(r => Math.max(0, r.balance)), 1)

    rows.forEach(r => {
      const tr = document.createElement('tr')
      const balanceClass = r.balance > 0 ? 'balance-positive' : (r.balance < 0 ? 'balance-negative' : 'balance-zero')
      const pct = Math.max(0, Math.min(100, (r.balance / maxBalance) * 100))

      tr.innerHTML = `
        <td data-label="Customer">${escapeHtml(r.customer)}</td>
        <td data-label="Total Issued">${r.issued}</td>
        <td data-label="Total Returned">${r.returned}</td>
        <td data-label="Net Balance" class="${balanceClass}">${r.balance}</td>
        <td data-label="Visual Scale">
          <div class="visual-bar-container">
            <div class="visual-bar" style="width: ${pct}%"></div>
          </div>
        </td>
      `
      tbody.appendChild(tr)
    })
  }

  function renderStaffTable() {
    const tbody = document.querySelector('#staff-table tbody')
    tbody.innerHTML = ''

    if (staff.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No rostered staff.</td></tr>`
      return
    }

    staff.forEach(s => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td data-label="Name">${escapeHtml(s.name)}</td>
        <td data-label="Linked Email">${escapeHtml(s.email || '—')}</td>
        <td data-label="Actions">
          <div class="row-actions">
            <button class="btn secondary-btn edit-staff-btn">Edit</button>
            <button class="btn logout-btn remove-staff-btn">Remove</button>
          </div>
        </td>
      `
      
      tr.querySelector('.edit-staff-btn').addEventListener('click', () => startEditStaff(s))
      tr.querySelector('.remove-staff-btn').addEventListener('click', () => onRemoveStaff(s.id, s.name))
      tbody.appendChild(tr)
    })
  }

  function renderCustomersTable() {
    const tbody = document.querySelector('#customers-table tbody')
    tbody.innerHTML = ''

    if (customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No customers registered.</td></tr>`
      return
    }

    customers.forEach(c => {
      const tr = document.createElement('tr')
      const statusBadge = c.status === 'Active' 
        ? '<span class="badge badge-active">Active</span>' 
        : '<span class="badge badge-inactive">Inactive</span>'

      const contactInfo = `
        <div class="contact-info-cell">
          <span class="contact-email" title="Email">${escapeHtml(c.email || '—')}</span>
          <span class="contact-phone" title="Phone">${escapeHtml(c.phone || '—')}</span>
        </div>
      `

      tr.innerHTML = `
        <td data-label="Customer Name"><strong>${escapeHtml(c.name)}</strong></td>
        <td data-label="Contact Person">${escapeHtml(c.contact_person || '—')}</td>
        <td data-label="Contact Info">${contactInfo}</td>
        <td data-label="Address">${escapeHtml(c.address || '—')}</td>
        <td data-label="Status">${statusBadge}</td>
        <td data-label="Actions">
          <div class="row-actions">
            <button class="btn secondary-btn edit-customer-btn">Edit</button>
            <button class="btn logout-btn delete-customer-btn">Delete</button>
          </div>
        </td>
      `

      tr.querySelector('.edit-customer-btn').addEventListener('click', () => startEditCustomer(c))
      tr.querySelector('.delete-customer-btn').addEventListener('click', () => onDeleteCustomer(c.id, c.name))
      tbody.appendChild(tr)
    })
  }

  // --- SELECTS & AUTOCOMPLETE POPULATION ---
  function populateStaffSelect() {
    const sel = document.getElementById('staff-select')
    const val = sel.value
    sel.innerHTML = '<option value="">— select staff —</option>'

    staff.forEach(s => {
      const o = document.createElement('option')
      o.value = s.name
      o.textContent = s.name
      sel.appendChild(o)
    })

    if (val && staff.some(s => s.name === val)) {
      sel.value = val
    }
  }

  function populateFilters() {
    const filterCustomer = document.getElementById('filter-customer')
    const filterStaff = document.getElementById('filter-staff')

    const savedCust = filterCustomer.value
    const savedStaff = filterStaff.value

    filterCustomer.innerHTML = '<option value="">All customers</option>'
    filterStaff.innerHTML = '<option value="">All staff</option>'

    const uniqueCustomers = Array.from(new Set(movements.map(m => m.customer))).sort()
    uniqueCustomers.forEach(c => {
      const o = document.createElement('option')
      o.value = c
      o.textContent = c
      filterCustomer.appendChild(o)
    })

    staff.forEach(s => {
      const o = document.createElement('option')
      o.value = s.name
      o.textContent = s.name
      filterStaff.appendChild(o)
    })

    filterCustomer.value = savedCust
    filterStaff.value = savedStaff
  }

  function populateCustomerDatalist() {
    const dl = document.getElementById('customers-list')
    dl.innerHTML = ''

    // Recommended active customer names only
    const activeNames = customers.filter(c => c.status !== 'Inactive').map(c => c.name)
    const list = Array.from(new Set(activeNames)).sort()

    list.forEach(c => {
      const o = document.createElement('option')
      o.value = c
      dl.appendChild(o)
    })
  }

  // --- CSV EXPORT IMPLEMENTATION ---
  function onExportCSV() {
    const rows = [['Date', 'Recorded at', 'Customer', 'Type', 'Quantity', 'Staff', 'Notes', 'Edited at']]

    const filterCustomer = document.getElementById('filter-customer').value
    const filterType = document.getElementById('filter-type').value
    const filterStaff = document.getElementById('filter-staff').value

    const filtered = movements.filter(m => {
      if (filterCustomer && m.customer !== filterCustomer) return false
      if (filterType && m.type !== filterType) return false
      if (filterStaff && m.staff !== filterStaff) return false
      return true
    })

    filtered.forEach(m => {
      rows.push([
        m.date,
        m.recorded_at,
        m.customer,
        m.type,
        m.qty,
        m.staff,
        m.note || '',
        m.edited_at || ''
      ])
    })

    downloadCSV(rows, `movements-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function onExportBalancesCSV() {
    const rows = [['Customer', 'Total Issued', 'Total Returned', 'Net Outstanding Balance']]
    const totals = calculateCustomerTotals()

    Object.entries(totals).forEach(([customer, t]) => {
      rows.push([customer, t.issued, t.returned, t.issued - t.returned])
    })

    const headers = rows.shift()
    rows.sort((a, b) => b[3] - a[3])
    rows.unshift(headers)

    downloadCSV(rows, `balances-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function csvEscape(v) {
    const s = String(v || '')
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  // --- EVENT BINDINGS ---
  function bindEvents() {
    // Client-side Hash Router
    window.addEventListener('hashchange', handleRouting)

    // Auth screen buttons
    document.getElementById('btn-toggle-signup').addEventListener('click', () => {
      document.getElementById('login-form').classList.add('hidden')
      document.getElementById('signup-form').classList.remove('hidden')
      document.getElementById('auth-alert').classList.add('hidden')
    })

    document.getElementById('btn-toggle-login').addEventListener('click', () => {
      document.getElementById('signup-form').classList.add('hidden')
      document.getElementById('login-form').classList.remove('hidden')
      document.getElementById('auth-alert').classList.add('hidden')
    })

    document.getElementById('btn-confirm-done').addEventListener('click', () => {
      document.getElementById('confirm-email-msg').classList.add('hidden')
      document.getElementById('login-form').classList.remove('hidden')
    })

    document.getElementById('login-form').addEventListener('submit', onLoginSubmit)
    document.getElementById('signup-form').addEventListener('submit', onSignupSubmit)
    document.getElementById('btn-logout').addEventListener('click', onLogoutClick)

    // Form inputs
    document.getElementById('movement-form').addEventListener('submit', onSubmitMovement)
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit)
    document.getElementById('staff-form').addEventListener('submit', onAddStaff)
    document.getElementById('customer-form').addEventListener('submit', onSubmitCustomer)

    // Modal Edit Form submits & cancel/close clicks
    document.getElementById('modal-customer-form').addEventListener('submit', onSaveCustomerEdit)
    document.getElementById('btn-close-customer-modal').addEventListener('click', closeCustomerModal)
    document.getElementById('btn-cancel-customer-modal').addEventListener('click', closeCustomerModal)

    document.getElementById('modal-staff-form').addEventListener('submit', onSaveStaffEdit)
    document.getElementById('btn-close-staff-modal').addEventListener('click', closeStaffModal)
    document.getElementById('btn-cancel-staff-modal').addEventListener('click', closeStaffModal)
    
    // Header staff selector sync
    document.getElementById('staff-select').addEventListener('change', (e) => {
      const val = e.target.value
      selectedStaffName = val
      const profileRoleEl = document.getElementById('user-staff-name')
      if (val) {
        profileRoleEl.textContent = `Operator: ${val}`
      } else {
        profileRoleEl.textContent = 'Select active operator'
      }
    })

    // CSV buttons
    document.getElementById('export-csv').addEventListener('click', onExportCSV)
    document.getElementById('export-balances-csv').addEventListener('click', onExportBalancesCSV)

    // Table filters
    document.getElementById('filter-customer').addEventListener('change', renderMovementsTable)
    document.getElementById('filter-type').addEventListener('change', renderMovementsTable)
    document.getElementById('filter-staff').addEventListener('change', renderMovementsTable)

    // Database Connection Error Retry
    document.getElementById('retry-db-btn').addEventListener('click', async () => {
      document.getElementById('view-error').classList.add('hidden')
      showLoader('Retrying database connection...')
      try {
        await loadDataFromDB()
        handleRouting()
      } catch (err) {
        console.error('Retry failed:', err)
      }
    })
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

})();
