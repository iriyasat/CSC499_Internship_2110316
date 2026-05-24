import os
import pandas as pd
import numpy as np
from tabulate import tabulate

# Resolve absolute path to CSV file
CSV_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "car_prices.csv"))

def main():
    print("====================================================")
    print("      VEHICLE SALES DATA ANALYSIS & INSIGHTS")
    print("====================================================")
    print(f"Loading dataset from: {CSV_FILE_PATH}\n")
    
    if not os.path.exists(CSV_FILE_PATH):
        print(f"[-] Error: CSV file not found at {CSV_FILE_PATH}")
        return

    # 1. Load Dataset
    # low_memory=False to prevent warning on mixed data types
    df_raw = pd.read_csv(CSV_FILE_PATH, on_bad_lines='skip', low_memory=False)
    
    total_raw_rows, total_raw_cols = df_raw.shape
    print(f"[1] Dataset Loaded successfully.")
    print(f"    - Raw Rows: {total_raw_rows}")
    print(f"    - Raw Columns: {total_raw_cols}\n")

    # 2. Data Cleaning
    print("[2] Cleaning data (using fast vectorized operations)...")
    
    # Create working copy of dataframe
    df = df_raw.copy()

    # Drop duplicate rows
    duplicate_count = df.duplicated().sum()
    df.drop_duplicates(inplace=True)
    print(f"    - Duplicate rows removed: {duplicate_count}")

    # Strip whitespace from object columns and convert empty strings to NaN
    # Explicitly check for string/object column types to avoid warnings
    for col in df.columns:
        if df[col].dtype == 'object':
            df[col] = df[col].astype(str).str.strip()

    # Define common missing value placeholders
    missing_placeholders = ['', '—', 'null', 'Null', 'NULL', 'nan', 'Nan', 'NAN', 'none', 'None', 'NONE', 'n/a', 'N/A', 'na', 'NA', '-', 'undefined', 'Undefined']
    df.replace(missing_placeholders, np.nan, inplace=True)

    # Convert numeric columns (coerce invalid characters to NaN)
    numeric_cols = ['year', 'condition', 'odometer', 'mmr', 'sellingprice']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # Convert Saledate to proper datetime using fast vectorized string extraction
    # Example format: 'Tue Dec 16 2014 12:30:00 GMT-0800 (PST)'
    saledate_str = df['saledate'].astype(str)
    
    # Vectorized split by space
    date_parts = saledate_str.str.split(' ', expand=True)
    
    # We expect parts: 0:DayName, 1:Month, 2:Day, 3:Year, 4:Time
    # Check if we have at least 5 columns in the expanded dataframe
    if date_parts.shape[1] >= 5:
        # Reconstruct "Dec 16 2014 12:30:00"
        reconstructed_dates = date_parts[1] + ' ' + date_parts[2] + ' ' + date_parts[3] + ' ' + date_parts[4]
        df['saledate'] = pd.to_datetime(reconstructed_dates, format='%b %d %Y %H:%M:%S', errors='coerce')
    else:
        # Fallback to direct parsing
        df['saledate'] = pd.to_datetime(df['saledate'], errors='coerce')

    # Drop any rows with NaN in ANY column (strict handling of missing values)
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
    print(tabulate(df[display_cols].head(10), headers='keys', tablefmt='psql', showindex=False))

    print("\n--- LAST 10 ROWS ---")
    print(tabulate(df[display_cols].tail(10), headers='keys', tablefmt='psql', showindex=False))

    print("\n--- DATASET SHAPE SUMMARY ---")
    shape_df = pd.DataFrame({
        "Stage": ["Raw Dataset", "Cleaned & Processed Dataset"],
        "Rows": [total_raw_rows, df.shape[0]],
        "Columns": [total_raw_cols, df.shape[1]]
    })
    print(tabulate(shape_df, headers='keys', tablefmt='grid', showindex=False))

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
    print(tabulate(top_makes, headers='keys', tablefmt='psql', showindex=False))

    # Insight 2: Top 5 Most Profitable Vehicle Makes (Average Profit)
    print("\n2. Top 5 Most Profitable Vehicle Makes (Average Profit/Loss):")
    profitable_makes = df.groupby('make')['Profit/Loss'].mean().sort_values(ascending=False).head(5).reset_index()
    profitable_makes.columns = ['Make', 'Avg Profit/Loss ($)']
    profitable_makes['Avg Profit/Loss ($)'] = profitable_makes['Avg Profit/Loss ($)'].map(lambda x: f"${x:,.2f}" if isinstance(x, (int, float)) else f"${float(x):,.2f}")
    print(tabulate(profitable_makes, headers='keys', tablefmt='psql', showindex=False))

    # Insight 3: Monthly Sales Volume and Profit Trend
    print("\n3. Monthly Sales Volume and Profit Trend:")
    monthly_trend = df.groupby(['Sale Year', 'Sale Month'])[['sellingprice', 'Profit/Loss']].agg(
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
    print(tabulate(monthly_trend, headers=['Year', 'Month', 'Sales Volume', 'Total Revenue', 'Total Profit/Loss'], tablefmt='psql', showindex=False))

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
    print(tabulate(trans_comparison, headers='keys', tablefmt='psql', showindex=False))

if __name__ == "__main__":
    main()
