import os
import sys

import mysql.connector
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

TABLE_NAME = "car_sales"


def get_clean_data():
    connection = mysql.connector.connect(
        host=DB_HOST,
        port=int(DB_PORT),
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
    )
    query = f"""
        SELECT
            year, make, model, trim, body, transmission, vin, state,
            `condition`, odometer, color, interior, seller, mmr,
            sellingprice, saledate
        FROM {TABLE_NAME}
        ORDER BY saledate, id
    """
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.close()
        return pd.DataFrame(rows)
    finally:
        connection.close()


def format_currency(value):
    if pd.isna(value):
        return "N/A"
    return f"${float(value):,.2f}"


def print_table(frame, **_ignored):
    print(frame.to_string(index=False))

def main():
    print("====================================================")
    print("      VEHICLE SALES DATA ANALYSIS & INSIGHTS")
    print("====================================================")
    print(f"Loading cleaned dataset from MySQL table: {DB_NAME}.{TABLE_NAME}\n")

    # 1. Load Dataset
    df_raw = get_clean_data()

    total_raw_rows, total_raw_cols = df_raw.shape
    print(f"[1] Dataset Loaded successfully.")
    print(f"    - Raw Rows: {total_raw_rows}")
    print(f"    - Raw Columns: {total_raw_cols}\n")

    # 2. Data Cleaning
    print("[2] Preparing clean MySQL data for analysis...")
    
    # Create working copy of dataframe
    df = df_raw.copy()

    # Drop duplicate rows defensively; the pipeline already deduplicates before insert.
    duplicate_count = df.duplicated().sum()
    df.drop_duplicates(inplace=True)
    print(f"    - Duplicate rows removed: {duplicate_count}")

    # Normalize text columns and convert placeholders to missing values.
    for col in df.columns:
        if df[col].dtype == 'object':
            df[col] = df[col].astype(str).str.strip()

    missing_placeholders = ['', '—', 'null', 'Null', 'NULL', 'nan', 'Nan', 'NAN', 'none', 'None', 'NONE', 'n/a', 'N/A', 'na', 'NA', '-', 'undefined', 'Undefined']
    df.replace(missing_placeholders, pd.NA, inplace=True)

    # Convert numeric columns (coerce invalid characters to missing values).
    numeric_cols = ['year', 'condition', 'odometer', 'mmr', 'sellingprice']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # Convert saledate into a proper datetime using the MySQL-stored format.
    df['saledate'] = pd.to_datetime(df['saledate'], format='%d-%m-%Y,%A', errors='coerce')

    # Drop any rows with missing or unparseable values.
    rows_before_dropna = len(df)
    df.dropna(inplace=True)
    rows_dropped_nulls = rows_before_dropna - len(df)
    print(f"    - Rows with missing/invalid/unparseable values removed: {rows_dropped_nulls}")

    # Set appropriate final data types
    df['year'] = df['year'].astype(int)
    df['odometer'] = df['odometer'].astype(int)
    df['mmr'] = df['mmr'].astype(int)
    df['sellingprice'] = df['sellingprice'].astype(int)

    total_clean_rows, total_clean_cols = df.shape
    print(f"    - Cleaned Rows remaining: {total_clean_rows}")
    print(f"    - Cleaned Columns: {total_clean_cols}\n")

    # 3. Generate New Columns
    print("[3] Generating new columns...")
    df['Sale Year'] = df['saledate'].dt.year
    df['Sale Month'] = df['saledate'].dt.strftime('%B')
    df['Profit/Loss'] = df['sellingprice'] - df['mmr']
    print("    - Added column: 'Sale Year'")
    print("    - Added column: 'Sale Month'")
    print("    - Added column: 'Profit/Loss' (sellingprice - mmr)\n")

    # 4. Display Requested Outputs
    print("[4] DISPLAYING DATA SAMPLES")
    print("\n--- FIRST 10 ROWS ---")
    display_cols = ['year', 'make', 'model', 'trim', 'transmission', 'vin', 'odometer', 'sellingprice', 'saledate', 'Sale Year', 'Sale Month', 'Profit/Loss']
    print_table(df[display_cols].head(10))

    print("\n--- LAST 10 ROWS ---")
    print_table(df[display_cols].tail(10))

    print("\n--- DATASET SHAPE SUMMARY ---")
    shape_df = pd.DataFrame({
        "Stage": ["Raw Dataset", "Cleaned & Processed Dataset"],
        "Rows": [total_raw_rows, df.shape[0]],
        "Columns": [total_raw_cols, df.shape[1]]
    })
    print_table(shape_df, tablefmt='grid')

    # 5. Business Insights Generation
    print("\n====================================================")
    print("                BUSINESS INSIGHTS")
    print("====================================================")

    # Insight 1: Top 5 Vehicle Makes by Sales Volume
    print("\n1. Top 5 Vehicle Makes by Sales Volume:")
    # Ensure capitalization consistency
    df['make'] = df['make'].str.title()
    top_makes = df['make'].value_counts().head(5).reset_index()
    top_makes.columns = ['Make', 'Sales Volume']
    print_table(top_makes)

    # Insight 2: Top 5 Most Profitable Vehicle Makes (Average Profit)
    print("\n2. Top 5 Most Profitable Vehicle Makes (Average Profit/Loss):")
    profitable_makes = df.groupby('make')['Profit/Loss'].mean().sort_values(ascending=False).head(5).reset_index()
    profitable_makes.columns = ['Make', 'Avg Profit/Loss ($)']
    profitable_makes['Avg Profit/Loss ($)'] = profitable_makes['Avg Profit/Loss ($)'].map(format_currency)
    print_table(profitable_makes)

    # Insight 3: Monthly Sales Volume and Profit Trend
    print("\n3. Monthly Sales Volume and Profit Trend:")
    monthly_trend = df.groupby(['Sale Year', 'Sale Month']).agg(
        Sales_Count=('sellingprice', 'count'),
        Total_Revenue=('sellingprice', 'sum'),
        Total_Profit=('Profit/Loss', 'sum')
    ).reset_index()
    
    # Sort months chronologically
    month_order = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    monthly_trend['Sale Month'] = pd.Categorical(monthly_trend['Sale Month'], categories=month_order, ordered=True)
    monthly_trend = monthly_trend.sort_values(['Sale Year', 'Sale Month']).reset_index(drop=True)
    
    monthly_trend['Total_Revenue'] = monthly_trend['Total_Revenue'].map('${:,.2f}'.format)
    monthly_trend['Total_Profit'] = monthly_trend['Total_Profit'].map('${:,.2f}'.format)
    monthly_trend = monthly_trend.rename(columns={'Sale Year': 'Year', 'Sale Month': 'Month'})
    print_table(monthly_trend[['Year', 'Month', 'Sales_Count', 'Total_Revenue', 'Total_Profit']], headers=['Year', 'Month', 'Sales Volume', 'Total Revenue', 'Total Profit/Loss'])

    # Insight 4: Transmission Type Sales Volume & Average Price Comparison
    print("\n4. Transmission Type Comparison:")
    df['transmission'] = df['transmission'].str.lower()
    trans_comparison = df.groupby('transmission')[['sellingprice', 'Profit/Loss']].agg(
        Sales_Count=('sellingprice', 'count'),
        Avg_Selling_Price=('sellingprice', 'mean'),
        Avg_Profit_Loss=('Profit/Loss', 'mean')
    ).reset_index()
    trans_comparison.columns = ['Transmission', 'Sales Volume', 'Avg Selling Price', 'Avg Profit/Loss']
    trans_comparison['Avg Selling Price'] = trans_comparison['Avg Selling Price'].map('${:,.2f}'.format)
    trans_comparison['Avg Profit/Loss'] = trans_comparison['Avg Profit/Loss'].map('${:,.2f}'.format)
    print_table(trans_comparison)

if __name__ == "__main__":
    main()
