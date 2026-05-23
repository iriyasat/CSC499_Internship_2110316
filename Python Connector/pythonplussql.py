from work_db import DB_HOST, DB_NAME, DB_PORT, get_connection, get_schema, init_db


if __name__ == "__main__":
    init_db()
    mydb = get_connection()
    try:
        print(f"Connected to {DB_NAME} on {DB_HOST}:{DB_PORT}")
        print(mydb)
        current_table = None
        for row in get_schema():
            table_name = row["TABLE_NAME"]
            if table_name != current_table:
                current_table = table_name
                print(f"[{table_name}]")
            print(
                f"  {row['COLUMN_NAME']} | {row['COLUMN_TYPE']} | {row['IS_NULLABLE']} | {row['COLUMN_DEFAULT']} | {row['EXTRA']}"
            )
    finally:
        mydb.close()