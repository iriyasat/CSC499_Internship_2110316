import sys
import mysql.connector
from mysql.connector import Error
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

def connect_mysql():
    """Establishes connection to MySQL service."""
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except Error as e:
        print(f"[-] Error connecting to MySQL Server: {e}")
        sys.exit(1)

def setup_database(conn):
    """Creates database and table if not exists."""
    cursor = conn.cursor()
    try:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        print(f"[+] Database '{DB_NAME}' checked/created successfully.")
        
        cursor.execute(f"USE {DB_NAME}")
        
        create_table_query = """
        CREATE TABLE IF NOT EXISTS car_sales (
            id INT AUTO_INCREMENT PRIMARY KEY,
            year INT,
            make VARCHAR(50),
            model VARCHAR(100),
            trim VARCHAR(100),
            body VARCHAR(50),
            transmission VARCHAR(20),
            vin VARCHAR(50),
            state VARCHAR(10),
            `condition` FLOAT,
            odometer INT,
            color VARCHAR(50),
            interior VARCHAR(50),
            seller VARCHAR(255),
            mmr INT,
            sellingprice INT,
            saledate DATE,
            saleday VARCHAR(20),
            INDEX idx_vin (vin)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
        cursor.execute(create_table_query)
        print("[+] Table 'car_sales' checked/created successfully.")
    except Error as e:
        print(f"[-] Error setting up database/table: {e}")
        sys.exit(1)
    finally:
        cursor.close()
