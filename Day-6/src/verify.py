import os
import sys
import mysql.connector
from mysql.connector import Error

# Ensure imports from sibling modules work when running as a script
sys.path.insert(0, os.path.dirname(__file__))
from db import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def verify_data():
    print("====================================================")
    print("      DATABASE VERIFICATION AND QUALITY CHECK")
    print("====================================================")
    
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor(dictionary=True)
        
        # 1. Check Row Count
        cursor.execute("SELECT COUNT(*) AS total_rows FROM car_sales")
        total_rows = cursor.fetchone()['total_rows']
        print(f"[+] Total records in 'car_sales': {total_rows}")
        
        # 2. Check for missing values (NULL checks)
        columns_to_check = [
            "year", "make", "model", "trim", "body", "transmission", "vin", 
            "state", "`condition`", "odometer", "color", "interior", "seller", 
            "mmr", "sellingprice", "saledate", "saleday"
        ]
        
        null_counts = {}
        for col in columns_to_check:
            cursor.execute(f"SELECT COUNT(*) AS nulls FROM car_sales WHERE {col} IS NULL")
            null_counts[col] = cursor.fetchone()['nulls']
            
        has_nulls = False
        print("\n[ Checking for missing/null values in database... ]")
        for col, count in null_counts.items():
            if count > 0:
                print(f"  [-] Column {col} has {count} NULL values.")
                has_nulls = True
        
        if not has_nulls:
            print("  [+] Clean Data Verification: No NULL values found in any column!")

        # 3. Retrieve Chronologically First and Last Rows (using auto-increment ID order)
        print("\n[ Retrieving chronological samples (Sorted by database ID order)... ]")
        cursor.execute("SELECT id, year, make, model, vin, sellingprice, saledate, saleday FROM car_sales ORDER BY id ASC LIMIT 3")
        first_three = cursor.fetchall()
        
        cursor.execute("SELECT id, year, make, model, vin, sellingprice, saledate, saleday FROM car_sales ORDER BY id DESC LIMIT 3")
        last_three = cursor.fetchall()
        
        print("\n--- Earliest Sold Vehicles ---")
        for row in first_three:
            print(f"ID: {row['id']} | VIN: {row['vin']} | {row['year']} {row['make']} {row['model']} | Price: ${row['sellingprice']} | Sale Date: {row['saledate']} ({row['saleday']})")
            
        print("\n--- Latest Sold Vehicles (descending order) ---")
        for row in last_three:
            print(f"ID: {row['id']} | VIN: {row['vin']} | {row['year']} {row['make']} {row['model']} | Price: ${row['sellingprice']} | Sale Date: {row['saledate']} ({row['saleday']})")

        cursor.close()
        conn.close()
        print("\n====================================================")
        print("[+] Verification completed successfully.")
        
    except Error as e:
        print(f"[-] Error querying database: {e}")

if __name__ == "__main__":
    verify_data()
