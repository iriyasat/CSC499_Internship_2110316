import os
import csv
import sys
import argparse

# Ensure imports from sibling modules work when running as a script
sys.path.insert(0, os.path.dirname(__file__))

from db import CSV_FILE_PATH, MAX_ROWS, DB_NAME, clean_row, connect_mysql, setup_database, Error

def main():
    parser = argparse.ArgumentParser(description="Vehicle Sales Data Pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Clean data and show stats without inserting into MySQL")
    args = parser.parse_args()

    print("====================================================")
    print("      VEHICLE SALES DATA PIPELINE (MySQL)")
    print("====================================================")
    print(f"Source CSV: {CSV_FILE_PATH}")
    print(f"Target Max Records: {MAX_ROWS}")
    
    if not os.path.exists(CSV_FILE_PATH):
        print(f"[-] Error: CSV file not found at {CSV_FILE_PATH}")
        sys.exit(1)

    print("\n[1] Reading and cleaning CSV records...")
    cleaned_records = []
    total_processed = 0
    total_skipped = 0

    with open(CSV_FILE_PATH, mode='r', encoding='utf-8', errors='ignore') as f:
        # Some CSVs contain weird characters, errors='ignore' ensures robust reading
        reader = csv.DictReader(f)
        for row in reader:
            total_processed += 1
            cleaned = clean_row(row)
            
            if cleaned is not None:
                cleaned_records.append(cleaned)
                if len(cleaned_records) == MAX_ROWS:
                    print(f"[+] Reached target of {MAX_ROWS} cleaned records.")
                    break
            else:
                total_skipped += 1

    print(f"[*] Total rows scanned: {total_processed}")
    print(f"[*] Cleaned rows collected: {len(cleaned_records)}")
    print(f"[*] Bad/Missing rows skipped: {total_skipped}")

    if not cleaned_records:
        print("[-] No valid records were found. Exiting.")
        sys.exit(0)

    # 3. Sort by saledate_obj chronologically
    print("\n[2] Sorting records chronologically by sale date...")
    cleaned_records.sort(key=lambda x: x['saledate_obj'])
    print(f"[+] First record date: {cleaned_records[0]['saledate']} (Parsed: {cleaned_records[0]['saledate_obj']})")
    print(f"[+] Last record date: {cleaned_records[-1]['saledate']} (Parsed: {cleaned_records[-1]['saledate_obj']})")

    # If dry run, print a few sample rows and finish
    if args.dry_run:
        print("\n=== DRY RUN MODE: Printing top 5 sorted records ===")
        for i, rec in enumerate(cleaned_records[:5]):
            print(f"Record #{i+1}:")
            print(f"  VIN: {rec['vin']}")
            print(f"  Year/Make/Model: {rec['year']} {rec['make']} {rec['model']}")
            print(f"  Price: {rec['sellingprice']} | MMR: {rec['mmr']}")
            print(f"  Sale Date (Raw Parsed): {rec['saledate_obj']}")
            print(f"  Sale Date (Formatted): {rec['saledate']}")
        print("================================================")
        print("[+] Dry run complete. Database was NOT modified.")
        return

    # 4. Connect to DB and Insert
    print("\n[3] Connecting to MySQL database...")
    conn = connect_mysql()
    setup_database(conn)

    # Bulk insert
    print(f"\n[4] Inserting {len(cleaned_records)} records into MySQL...")
    cursor = conn.cursor()
    
    # We will use USE first to make sure we are inside our database
    cursor.execute(f"USE {DB_NAME}")

    insert_query = """
    INSERT INTO car_sales (
        year, make, model, trim, body, transmission, vin, state, 
        `condition`, odometer, color, interior, seller, mmr, 
        sellingprice, saledate, saleday
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    # Prepare list of tuples (inserting formatted saledate string directly)
    insert_data = [
        (
            r['year'], r['make'], r['model'], r['trim'], r['body'], r['transmission'], r['vin'], r['state'],
            r['condition'], r['odometer'], r['color'], r['interior'], r['seller'], r['mmr'],
            r['sellingprice'], r['saledate'], r['saleday']
        )
        for r in cleaned_records
    ]

    try:
        # Truncate existing records to avoid duplicate inserts on multiple runs
        cursor.execute("TRUNCATE TABLE car_sales")
        print(f"[+] Existing table records truncated to ensure a clean insert of the {len(cleaned_records)} sorted records.")

        batch_size = 5000
        total_inserted = 0
        for i in range(0, len(insert_data), batch_size):
            batch = insert_data[i:i+batch_size]
            cursor.executemany(insert_query, batch)
            total_inserted += len(batch)
            print(f"    - Inserted batch {i // batch_size + 1} ({len(batch)} records)...")

        conn.commit()
        print(f"[+] Successfully inserted {total_inserted} records into MySQL!")
    except Error as e:
        try:
            conn.rollback()
        except Error as rollback_err:
            print(f"[-] Rollback failed: {rollback_err}")
        print(f"[-] Database insert failed: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()
        print("[+] MySQL connection closed.")

if __name__ == "__main__":
    main()
