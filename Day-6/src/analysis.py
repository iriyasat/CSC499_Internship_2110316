import os
import sys
import mysql.connector
from mysql.connector import Error
from tabulate import tabulate

# Ensure imports from sibling modules work when running as a script
sys.path.insert(0, os.path.dirname(__file__))
from db import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def run_sql_query(cursor, query):
    """Utility to run a query and fetch all results."""
    cursor.execute(query)
    if cursor.description:
        return cursor.fetchall()
    return None

def main():
    print("====================================================")
    print("      VEHICLE SALES SQL DATA ANALYSIS & INSIGHTS")
    print("====================================================")
    print(f"Connecting to database: {DB_NAME} on port {DB_PORT}...\n")
    
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor(dictionary=True)
        
        # 1. Dataset Shape (Total Rows and Columns)
        # Total Rows
        cursor.execute("SELECT COUNT(*) AS total_rows FROM car_sales")
        total_rows = cursor.fetchone()['total_rows']
        
        # Total Columns (Base columns in database table)
        cursor.execute("DESCRIBE car_sales")
        columns_desc = cursor.fetchall()
        base_columns_count = len(columns_desc)
        
        # We also generate 3 virtual columns (Sale Year, Sale Month, Profit/Loss)
        total_columns_count = base_columns_count + 3 
        
        print("[1] Dataset Loaded (via MySQL Database).")
        print(f"    - Total Rows in Database: {total_rows}")
        print(f"    - Table Base Columns: {base_columns_count}")
        print(f"    - Generated Columns: 3 (Sale Year, Sale Month, Profit/Loss)")
        print(f"    - Total Displayed Columns: {total_columns_count}\n")

        # 2. Data Cleaning Validation (Handling missing, duplicates, and types using SQL)
        print("[2] Running Data Quality Checks (SQL Terms):")
        
        # Check for any remaining NULL values in the dataset
        columns_to_check = [
            "year", "make", "model", "trim", "body", "transmission", "vin", 
            "state", "`condition`", "odometer", "color", "interior", "seller", 
            "mmr", "sellingprice", "saledate", "saleday"
        ]
        null_conditions = " OR ".join([f"{col} IS NULL" for col in columns_to_check])
        cursor.execute(f"SELECT COUNT(*) AS null_count FROM car_sales WHERE {null_conditions}")
        null_count = cursor.fetchone()['null_count']
        print(f"    - Rows with missing values (NULL checks): {null_count}")
        
        # Check for duplicates based on VIN
        cursor.execute("SELECT COUNT(*) - COUNT(DISTINCT vin) AS duplicate_vins FROM car_sales")
        duplicate_count = cursor.fetchone()['duplicate_vins']
        print(f"    - Duplicate VIN records: {duplicate_count}")
        
        # Show column data types using SQL terms
        print("    - Database Field Types (SQL Describe):")
        types_table = []
        for col in columns_desc:
            types_table.append([col['Field'], col['Type'], col['Null'], col['Key']])
        print(tabulate(types_table, headers=['Field', 'Type', 'Null', 'Key'], tablefmt='psql'))
        print()

        # 3. Generate New Columns & Display Data Samples
        # We select the standard fields and generate Sale Year, Sale Month, and Profit/Loss dynamically.
        # Profit/Loss = sellingprice - mmr
        # Sale Year = YEAR(saledate)
        # Sale Month = MONTHNAME(saledate)
        query_samples = """
        SELECT
            id,
            year, 
            make, 
            model,
            transmission,  
            sellingprice, 
            saledate, 
            saleday,
            YEAR(saledate) AS `Sale Year`, 
            MONTHNAME(saledate) AS `Sale Month`, 
            (sellingprice - mmr) AS `Profit/Loss`
        FROM car_sales
        """
        
        print("[3] DISPLAYING DATA SAMPLES (with Dynamically Generated Columns)")
        
        # Display First 10 Rows
        print("\n--- FIRST 10 ROWS (ORDER BY id ASC) ---")
        first_10 = run_sql_query(cursor, f"{query_samples} ORDER BY id ASC LIMIT 10")
        print(tabulate(first_10, headers='keys', tablefmt='psql', showindex=False))

        # Display Last 10 Rows
        print("\n--- LAST 10 ROWS (ORDER BY id DESC) ---")
        last_10_desc = run_sql_query(cursor, f"{query_samples} ORDER BY id DESC LIMIT 10")
        last_10 = list(reversed(last_10_desc))
        print(tabulate(last_10, headers='keys', tablefmt='psql', showindex=False))
        
        # 4. Generate Business Insights using SQL
        print("\n====================================================")
        print("                BUSINESS INSIGHTS (SQL)")
        print("====================================================")

        # Insight 1: Top 5 Vehicle Makes by Sales Volume
        print("\n1. Top 5 Vehicle Makes by Sales Volume (SQL GROUP BY):")
        query_makes = """
        SELECT make AS `Make`, COUNT(*) AS `Sales Volume`
        FROM car_sales
        GROUP BY make
        ORDER BY `Sales Volume` DESC
        LIMIT 5;
        """
        top_makes = run_sql_query(cursor, query_makes)
        print(tabulate(top_makes, headers='keys', tablefmt='psql', showindex=False))

        # Insight 2: Top 5 Most Profitable Vehicle Makes (Average Profit/Loss)
        print("\n2. Top 5 Most Profitable Vehicle Makes (Average Profit/Loss):")
        query_profit = """
        SELECT make AS `Make`, AVG(sellingprice - mmr) AS `Avg Profit/Loss`
        FROM car_sales
        GROUP BY make
        ORDER BY `Avg Profit/Loss` DESC
        LIMIT 5;
        """
        top_profit = run_sql_query(cursor, query_profit)
        # Format currency in Python for clean display
        formatted_profit = []
        for row in top_profit:
            avg_p = row['Avg Profit/Loss']
            formatted_profit.append({
                'Make': row['Make'],
                'Avg Profit/Loss ($)': f"${avg_p:,.2f}" if avg_p is not None else "$0.00"
            })
        print(tabulate(formatted_profit, headers='keys', tablefmt='psql', showindex=False))
    
        # Insight 3: Weekly Sales Volume and Profit Trend (SQL Days)
        print("\n3. Weekly Sales Volume and Profit Trend (SQL Days):")
        query_weekly = """
        SELECT 
            saleday AS `Day of Week`, 
            COUNT(*) AS `Sales Volume`,
            SUM(sellingprice) AS `Total Revenue`,
            SUM(sellingprice - mmr) AS `Total Profit/Loss`
        FROM car_sales
        GROUP BY saleday, WEEKDAY(saledate)
        ORDER BY WEEKDAY(saledate) ASC;
        """
        weekly_trend = run_sql_query(cursor, query_weekly)
        # Format currency
        formatted_weekly = []
        for row in weekly_trend:
            formatted_weekly.append({
                'Day of Week': row['Day of Week'],
                'Sales Volume': row['Sales Volume'],
                'Total Revenue': f"${row['Total Revenue']:,.2f}",
                'Total Profit/Loss': f"${row['Total Profit/Loss']:,.2f}"
            })
        print(tabulate(formatted_weekly, headers='keys', tablefmt='psql', showindex=False))
    
        # Insight 4: Monthly Sales Volume and Profit Trend
        print("\n4. Monthly Sales Volume and Profit Trend (SQL Dates):")
        query_monthly = """
        SELECT 
            YEAR(saledate) AS `Year`, 
            MONTHNAME(saledate) AS `Month`, 
            COUNT(*) AS `Sales Volume`,
            SUM(sellingprice) AS `Total Revenue`,
            SUM(sellingprice - mmr) AS `Total Profit/Loss`,
            MONTH(saledate) AS `month_num` -- Helper to sort chronologically
        FROM car_sales
        GROUP BY YEAR(saledate), MONTHNAME(saledate), MONTH(saledate)
        ORDER BY `Year` ASC, `month_num` ASC;
        """
        monthly_trend = run_sql_query(cursor, query_monthly)
        # Format currency
        formatted_monthly = []
        for row in monthly_trend:
            formatted_monthly.append({
                'Year': row['Year'],
                'Month': row['Month'],
                'Sales Volume': row['Sales Volume'],
                'Total Revenue': f"${row['Total Revenue']:,.2f}",
                'Total Profit/Loss': f"${row['Total Profit/Loss']:,.2f}"
            })
        print(tabulate(formatted_monthly, headers='keys', tablefmt='psql', showindex=False))

        # Insight 5: Transmission Type Sales Volume & Average Price Comparison
        print("\n5. Transmission Type Comparison:")
        query_transmission = """
        SELECT 
            transmission AS `Transmission`, 
            COUNT(*) AS `Sales Volume`,
            AVG(sellingprice) AS `Avg Selling Price`,
            AVG(sellingprice - mmr) AS `Avg Profit/Loss`
        FROM car_sales
        GROUP BY transmission;
        """
        trans_comparison = run_sql_query(cursor, query_transmission)
        # Format currency
        formatted_trans = []
        for row in trans_comparison:
            formatted_trans.append({
                'Transmission': row['Transmission'],
                'Sales Volume': row['Sales Volume'],
                'Avg Selling Price': f"${row['Avg Selling Price']:,.2f}",
                'Avg Profit/Loss': f"${row['Avg Profit/Loss']:,.2f}"
            })
        print(tabulate(formatted_trans, headers='keys', tablefmt='psql', showindex=False))

        cursor.close()
        conn.close()
        print("\n====================================================")
        print("[+] SQL Data Analysis completed successfully.")
        
    except Error as e:
        print(f"[-] Database Error during analysis: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
