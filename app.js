// Pallet Tracker - vanilla JS implementation (localStorage + Supabase placeholders)
(function(){
  // Local storage keys
  const KEY_MOVEMENTS = 'pallet-movements'
  const KEY_STAFF = 'pallet-staff'
  const KEY_CUSTOMERS = 'pallet-customers'
  const KEY_ACTIVE_STAFF = 'pallet-active-staff'
  const KEY_AUDIT = 'pallet-audit'

  // Supabase placeholders (set your values in README or environment)
  const SUPABASE_URL = ''
  const SUPABASE_ANON_KEY = ''

  // In-memory state
  let movements = []
  let staff = []
  let customers = []
  let audit = []
  let editingId = null

  // Helpers
  const $ = id => document.getElementById(id)
  function readLS(){
    movements = JSON.parse(localStorage.getItem(KEY_MOVEMENTS) || '[]')
    staff = JSON.parse(localStorage.getItem(KEY_STAFF) || '[]')
    customers = JSON.parse(localStorage.getItem(KEY_CUSTOMERS) || '[]')
    audit = JSON.parse(localStorage.getItem(KEY_AUDIT) || '[]')
  }
  function writeLS(){
    localStorage.setItem(KEY_MOVEMENTS, JSON.stringify(movements))
    localStorage.setItem(KEY_STAFF, JSON.stringify(staff))
    localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(customers))
    localStorage.setItem(KEY_AUDIT, JSON.stringify(audit))
  }

  // Init
  document.addEventListener('DOMContentLoaded', ()=>{
    // default date
    const today = new Date().toISOString().slice(0,10)
    $('date').value = today

    readLS()
    bindEvents()
    renderAll()
  })

  function bindEvents(){
    $('movement-form').addEventListener('submit', onSubmit)
    $('add-staff').addEventListener('click', onAddStaff)
    $('export-csv').addEventListener('click', onExportCSV)
    $('undo-btn').addEventListener('click', onUndo)
    $('filter-customer').addEventListener('change', renderMovementsTable)
    $('filter-type').addEventListener('change', renderMovementsTable)
    $('filter-staff').addEventListener('change', renderMovementsTable)
    $('edit-customer').addEventListener('click', onEditCustomer)
  }

  function renderAll(){
    renderStaff()
    renderCustomers()
    renderMetrics()
    renderMovementsTable()
    renderBalances()
  }

  // Staff management
  function renderStaff(){
    const sel = $('staff-select')
    const fstaff = $('filter-staff')
    sel.innerHTML = ''
    fstaff.innerHTML = '<option value="">All staff</option>'
    staff.forEach(s=>{
      const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o)
      const o2 = document.createElement('option'); o2.value = s; o2.textContent = s; fstaff.appendChild(o2)
    })
    // ensure an active staff exists
    if(!sel.value && staff.length) sel.value = staff[0]
  }
  function onAddStaff(){
    const name = $('new-staff-name').value.trim()
    if(!name) return alert('Enter a staff name')
    if(staff.some(s=>s.toLowerCase()===name.toLowerCase())) return alert('Duplicate staff name')
    staff.push(name)
    $('new-staff-name').value = ''
    writeLS()
    renderAll()
  }

  // Customers
  function renderCustomers(){
    const datalist = $('customers-list')
    const f = $('filter-customer')
    datalist.innerHTML = ''
    f.innerHTML = '<option value="">All customers</option>'
    customers.forEach(c=>{
      const opt = document.createElement('option'); opt.value = c; datalist.appendChild(opt)
      const opt2 = document.createElement('option'); opt2.value = c; opt2.textContent = c; f.appendChild(opt2)
    })
  }
  function onEditCustomer(){
    const current = $('customer').value.trim()
    if(!current) return alert('Choose a customer in the field first')
    const newName = prompt('Edit customer name', current)
    if(!newName) return
    // replace in customers array and in existing movement records
    const idx = customers.findIndex(c=>c.toLowerCase()===current.toLowerCase())
    if(idx!==-1 && customers.some((c,i)=>i!==idx && c.toLowerCase()===newName.toLowerCase())) return alert('Duplicate customer name')
    if(idx!==-1) customers[idx]=newName
    movements.forEach(m=>{ if(m.customer.toLowerCase()===current.toLowerCase()) m.customer=newName })
    audit.push({op:'edit-customer', at:new Date().toISOString(), before:current, after:newName})
    writeLS(); renderAll()
  }

  // Metrics & balances
  function calculateCustomerTotals(){
    const map = {}
    movements.forEach(m=>{
      if(!map[m.customer]) map[m.customer]={issued:0,returned:0}
      if(m.type==='issue') map[m.customer].issued += m.qty
      else map[m.customer].returned += m.qty
    })
    return map
  }
  function renderMetrics(){
    const totals = calculateCustomerTotals()
    let totalIssued=0, totalReturned=0
    Object.values(totals).forEach(t=>{ totalIssued+=t.issued; totalReturned+=t.returned })
    $('total-issued').textContent = totalIssued
    $('total-returned').textContent = totalReturned
    $('net-outstanding').textContent = totalIssued - totalReturned
    $('customer-count').textContent = Object.keys(totals).length
  }
  function renderBalances(){
    const tbody = $('balances-table').querySelector('tbody'); tbody.innerHTML=''
    const totals = calculateCustomerTotals()
    const rows = Object.entries(totals).map(([customer,t])=>({customer,issued:t.issued,returned:t.returned,balance:t.issued-t.returned}))
    rows.sort((a,b)=>b.balance - a.balance || a.customer.localeCompare(b.customer))
    rows.forEach(r=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${r.customer}</td><td>${r.issued}</td><td>${r.returned}</td><td>${r.balance}</td>`
      tbody.appendChild(tr)
    })
  }

  // Movements table
  function renderMovementsTable(){
    const tbody = $('movements-table').querySelector('tbody'); tbody.innerHTML=''
    const filterCustomer = $('filter-customer').value
    const filterType = $('filter-type').value
    const filterStaff = $('filter-staff').value
    // reverse-chronological
    const list = movements.slice().sort((a,b)=>b.id - a.id).filter(m=>{
      if(filterCustomer && m.customer!==filterCustomer) return false
      if(filterType && m.type!==filterType) return false
      if(filterStaff && m.staff!==filterStaff) return false
      return true
    })
    list.forEach(m=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${m.date}${m.editedAt? ' ✎':''}</td><td>${escapeHtml(m.customer)}</td><td>${m.type}</td><td>${m.qty}</td><td>${escapeHtml(m.staff)}</td><td>${escapeHtml(m.note||'')}</td><td></td>`
      const actions = tr.querySelector('td:last-child')
      const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.addEventListener('click', ()=>startEdit(m.id))
      const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.addEventListener('click', ()=>deleteMovement(m.id))
      actions.appendChild(editBtn); actions.appendChild(delBtn)
      tbody.appendChild(tr)
    })
  }

  function startEdit(id){
    const m = movements.find(x=>x.id===id); if(!m) return
    editingId = id
    $('customer').value = m.customer
    $('qty').value = m.qty
    $('date').value = m.date
    $('note').value = m.note || ''
    document.querySelectorAll('input[name="type"]').forEach(r=>{ r.checked = r.value===m.type })
    $('staff-select').value = m.staff
    $('submit-btn').textContent = 'Save'
  }

  function deleteMovement(id){
    if(!confirm('Delete this movement? This is permanent.')) return
    const idx = movements.findIndex(m=>m.id===id); if(idx===-1) return
    const before = JSON.parse(JSON.stringify(movements[idx]))
    movements.splice(idx,1)
    audit.push({op:'delete', at:new Date().toISOString(), id, before})
    writeLS(); renderAll()
  }

  function onSubmit(e){
    e.preventDefault()
    const type = document.querySelector('input[name="type"]:checked').value
    const customer = $('customer').value.trim()
    const qty = Math.floor(Number($('qty').value))
    const date = $('date').value
    const note = $('note').value.trim()
    const staffName = $('staff-select').value
    if(!staffName) return alert('Select or add a staff member')
    if(!customer) return alert('Customer is required')
    if(!Number.isFinite(qty) || qty < 1) return alert('Quantity must be a positive integer')
    const totals = calculateCustomerTotals()
    const currentBalance = (totals[customer]?.issued||0) - (totals[customer]?.returned||0)
    if(type==='return' && qty > currentBalance) return alert('Return would create negative balance — blocked')

    if(editingId){
      const idx = movements.findIndex(m=>m.id===editingId); if(idx===-1) return
      const before = JSON.parse(JSON.stringify(movements[idx]))
      movements[idx].date = date
      movements[idx].customer = customer
      movements[idx].type = type
      movements[idx].qty = qty
      movements[idx].note = note
      movements[idx].staff = staffName
      movements[idx].editedAt = new Date().toISOString()
      audit.push({op:'edit', at:new Date().toISOString(), id:editingId, before, after:JSON.parse(JSON.stringify(movements[idx]))})
      editingId = null
      $('submit-btn').textContent = 'Record'
    } else {
      const id = Date.now()
      const rec = {id, date, recordedAt:new Date().toISOString(), editedAt:null, customer, type, qty, staff:staffName, note}
      movements.push(rec)
      if(!customers.some(c=>c.toLowerCase()===customer.toLowerCase())) customers.push(customer)
      audit.push({op:'create', at:new Date().toISOString(), id, after:JSON.parse(JSON.stringify(rec))})
    }

    writeLS(); renderAll()
    // form reset behaviour
    $('customer').value = ''
    $('note').value = ''
    $('qty').value = 1
  }

  function onExportCSV(){
    // export all movements (respecting filters)
    const rows = [['Date','Recorded at','Customer','Type','Qty','Staff','Note','Edited at']]
    const filterCustomer = $('filter-customer').value
    const filterType = $('filter-type').value
    const filterStaff = $('filter-staff').value
    movements.slice().sort((a,b)=>b.id-a.id).forEach(m=>{
      if(filterCustomer && m.customer!==filterCustomer) return
      if(filterType && m.type!==filterType) return
      if(filterStaff && m.staff!==filterStaff) return
      rows.push([m.date,m.recordedAt,m.customer,m.type,m.qty,m.staff,(m.note||''),m.editedAt||''])
    })
    const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download = `movements-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  function onUndo(){
    if(!audit.length) return alert('Nothing to undo')
    const last = audit.pop()
    if(last.op==='create'){
      // remove the created record
      movements = movements.filter(m=>m.id!==last.id)
    } else if(last.op==='delete'){
      // restore
      movements.push(last.before)
    } else if(last.op==='edit'){
      const idx = movements.findIndex(m=>m.id===last.id)
      if(idx!==-1) movements[idx] = last.before
    } else if(last.op==='edit-customer'){
      // revert customer rename
      const before = last.before, after = last.after
      customers = customers.map(c=> c===after? before : c)
      movements.forEach(m=>{ if(m.customer===after) m.customer=before })
    }
    writeLS(); renderAll()
  }

  // Utilities
  function csvEscape(v){
    const s = String(v||'')
    if(s.includes(',')||s.includes('\n')||s.includes('"')) return '"'+s.replace(/"/g,'""')+'"'
    return s
  }
  function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

  // Expose minimal supabase hooks (not implemented) — placeholders
  window.supabaseConfig = {url:SUPABASE_URL,key:SUPABASE_ANON_KEY}

})();
