import os
import sys
import mysql.connector
from mysql.connector import Error
from tabulate import tabulate

# Ensure imports from sibling modules work when running as a script
sys.path.insert(0, os.path.dirname(__file__))
from db import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def run_query(sql_query):
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        cursor = conn.cursor(dictionary=True)
        
        print(f"\n[Executing SQL Query]:\n{sql_query}\n")
        cursor.execute(sql_query)
        
        # Check if the query returns rows (SELECT, SHOW, etc.)
        if cursor.description:
            rows = cursor.fetchall()
            if rows:
                print(tabulate(rows, headers='keys', tablefmt='psql', showindex=False))
                print(f"\n[+] Returned {len(rows)} row(s).")
            else:
                print("[+] Query completed successfully. No rows returned.")
        else:
            conn.commit()
            print(f"[+] Query completed successfully. Affected rows: {cursor.rowcount}")
            
        cursor.close()
        conn.close()
        
    except Error as e:
        print(f"[-] Database Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_query(query)
    else:
        print("====================================================")
        print("           MYSQL ARBITRARY QUERY RUNNER")
        print("====================================================")
        print("Enter your SQL query below (type 'exit' or press Ctrl+C to quit):")
        while True:
            try:
                user_input = input("\nSQL> ").strip()
                if not user_input:
                    continue
                if user_input.lower() in ('exit', 'quit'):
                    break
                
                # Support multi-line input if the query doesn't end with a semicolon
                while not user_input.endswith(';'):
                    more_input = input("   > ").strip()
                    if not more_input:
                        break
                    user_input += " " + more_input
                
                run_query(user_input)
            except KeyboardInterrupt:
                print("\nExiting.")
                break
            except Exception as e:
                print(f"[-] Error: {e}")
