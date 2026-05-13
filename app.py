import streamlit as st
import pandas as pd
from datetime import datetime
import os

# --- CONFIGURATION ---
DATA_FILE = "pallet_data.csv"

# Initialize data if it doesn't exist
if not os.path.exists(DATA_FILE):
    df = pd.DataFrame(columns=["Date", "Customer", "Pallet_Type", "Action", "Quantity"])
    df.to_csv(DATA_FILE, index=False)

def load_data():
    return pd.read_csv(DATA_FILE)

def save_data(date, customer, pallet_type, action, quantity):
    df = load_data()
    new_entry = pd.DataFrame([[date, customer, pallet_type, action, quantity]], 
                             columns=["Date", "Customer", "Pallet_Type", "Action", "Quantity"])
    df = pd.concat([df, new_entry], ignore_index=True)
    df.to_csv(DATA_FILE, index=False)

# --- APP INTERFACE ---
st.set_page_config(page_title="Pallet Tracker", layout="centered")
st.title("📦 Pallet Tracker")

# 1. ADD MOVEMENT SECTION
with st.expander("➕ Log New Movement", expanded=True):
    date = st.date_input("Date", datetime.now())
    customer = st.text_input("Customer Name")
    p_type = st.selectbox("Pallet Type", ["CHEP", "Loscam", "Plain/Plain Wood"])
    action = st.radio("Action", ["Issue (Out)", "Return (In)"], horizontal=True)
    qty = st.number_input("Quantity", min_value=1, step=1)

    if st.button("Submit Movement", use_container_width=True):
        if customer:
            save_data(date, customer, p_type, action, qty)
            st.success(f"Recorded: {qty} {p_type} pallets for {customer}")
        else:
            st.error("Please enter a customer name.")

st.divider()

# 2. BALANCE TRACKER SECTION
st.subheader("📊 Current Balances")
df_log = load_data()

if not df_log.empty:
    # Logic to calculate balances
    # We treat 'Issue' as positive and 'Return' as negative for the math
    df_log['Calc_Qty'] = df_log.apply(lambda x: x['Quantity'] if "Issue" in x['Action'] else -x['Quantity'], axis=1)
    
    # Group by Customer and Pallet Type
    balance_df = df_log.groupby(['Customer', 'Pallet_Type'])['Calc_Qty'].sum().reset_index()
    balance_df.columns = ['Customer', 'Type', 'Current Balance']
    
    # Display the table
    st.dataframe(balance_df, use_container_width=True, hide_index=True)
else:
    st.info("No movements recorded yet.")

# 3. HISTORY
if st.checkbox("Show Transaction History"):
    st.write(df_log.sort_values(by="Date", ascending=False))
