"""Database helpers for the XAMPP MySQL employee_management database.

Import this module from pythonplussql.py to connect to MySQL and run create,
insert, update, delete, select, and schema inspection operations from code.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterable, Optional, Sequence, cast

import mysql.connector


DB_HOST = os.getenv("EMPLOYEE_DB_HOST", "localhost")
DB_PORT = int(os.getenv("EMPLOYEE_DB_PORT", "33007"))
DB_USER = os.getenv("EMPLOYEE_DB_USER", "root")
DB_PASSWORD = os.getenv("EMPLOYEE_DB_PASSWORD", "")
DB_NAME = os.getenv("EMPLOYEE_DB_NAME", "employee_management")


def _connect(database: str | None = DB_NAME):
    connection_kwargs = {
        "host": DB_HOST,
        "port": DB_PORT,
        "user": DB_USER,
        "password": DB_PASSWORD,
    }
    if database:
        connection_kwargs["database"] = database
    conn = mysql.connector.connect(**connection_kwargs)
    return conn


def get_connection():
    conn = _connect()
    return conn


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        yield conn, cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute(sql: str, params: Sequence[Any] = ()) -> int:
    with db_cursor() as (_, cursor):
        cursor.execute(sql, params)
        return int(cursor.lastrowid or 0)


def executemany(sql: str, params_list: Iterable[Sequence[Any]]) -> None:
    with db_cursor() as (_, cursor):
        cursor.executemany(sql, list(params_list))


def fetch_all(sql: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
    with db_cursor() as (_, cursor):
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [cast(dict[str, Any], row) for row in rows]


def fetch_one(sql: str, params: Sequence[Any] = ()) -> Optional[dict[str, Any]]:
    with db_cursor() as (_, cursor):
        cursor.execute(sql, params)
        row = cursor.fetchone()
        return cast(Optional[dict[str, Any]], row)


def ensure_database() -> None:
    conn = _connect(database=None)
    try:
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    ensure_database()
    execute(
        """
        CREATE TABLE IF NOT EXISTS departments (
            department_id INT AUTO_INCREMENT PRIMARY KEY,
            department_name VARCHAR(100) NOT NULL,
            location VARCHAR(100)
        )
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS employees (
            employee_id INT AUTO_INCREMENT PRIMARY KEY,
            employee_name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE,
            phone VARCHAR(20),
            salary DECIMAL(10, 2) NOT NULL,
            joining_date DATE NOT NULL,
            department_id INT,
            status TINYINT(1) DEFAULT 1,
            FOREIGN KEY (department_id) REFERENCES departments(department_id)
        )
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS projects (
            project_id INT AUTO_INCREMENT PRIMARY KEY,
            project_name VARCHAR(100) NOT NULL,
            start_date DATE,
            end_date DATE,
            budget DECIMAL(12, 2)
        )
        """
    )
    execute(
        """
        CREATE TABLE IF NOT EXISTS employee_projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT,
            project_id INT,
            assigned_date DATE,
            FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
            FOREIGN KEY (project_id) REFERENCES projects(project_id)
        )
        """
    )


def get_schema() -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        """,
        (DB_NAME,),
    )


def add_department(department_name: str, location: str = "") -> int:
    return execute(
        """
        INSERT INTO departments (department_name, location)
        VALUES (%s, %s)
        """,
        (department_name, location),
    )


def update_department(department_id: int, **fields: Any) -> None:
    allowed = {"department_name", "location"}
    items = [(k, v) for k, v in fields.items() if k in allowed]
    if not items:
        return
    set_clause = ", ".join(f"{key} = %s" for key, _ in items)
    values = [value for _, value in items]
    execute(f"UPDATE departments SET {set_clause} WHERE department_id = %s", (*values, department_id))


def delete_department(department_id: int) -> None:
    execute("DELETE FROM departments WHERE department_id = %s", (department_id,))


def get_department(department_id: int) -> Optional[dict[str, Any]]:
    return fetch_one("SELECT * FROM departments WHERE department_id = %s", (department_id,))


def list_departments() -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM departments ORDER BY department_id DESC")


def add_employee(
    employee_name: str,
    email: str = "",
    phone: str = "",
    salary: float = 0.0,
    joining_date: str = "1970-01-01",
    department_id: Optional[int] = None,
    status: int = 1,
) -> int:
    return execute(
        """
        INSERT INTO employees (employee_name, email, phone, salary, joining_date, department_id, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (employee_name, email, phone, salary, joining_date, department_id, status),
    )


def update_employee(employee_id: int, **fields: Any) -> None:
    allowed = {"employee_name", "email", "phone", "salary", "joining_date", "department_id", "status"}
    items = [(k, v) for k, v in fields.items() if k in allowed]
    if not items:
        return
    set_clause = ", ".join(f"{key} = %s" for key, _ in items)
    values = [value for _, value in items]
    execute(f"UPDATE employees SET {set_clause} WHERE employee_id = %s", (*values, employee_id))


def delete_employee(employee_id: int) -> None:
    execute("DELETE FROM employees WHERE employee_id = %s", (employee_id,))


def get_employee(employee_id: int) -> Optional[dict[str, Any]]:
    return fetch_one("SELECT * FROM employees WHERE employee_id = %s", (employee_id,))


def list_employees() -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM employees ORDER BY employee_id DESC")


def add_project(project_name: str, start_date: str = "", end_date: str = "", budget: float = 0.0) -> int:
    return execute(
        """
        INSERT INTO projects (project_name, start_date, end_date, budget)
        VALUES (%s, %s, %s, %s)
        """,
        (project_name, start_date or None, end_date or None, budget),
    )


def update_project(project_id: int, **fields: Any) -> None:
    allowed = {"project_name", "start_date", "end_date", "budget"}
    items = [(k, v) for k, v in fields.items() if k in allowed]
    if not items:
        return
    set_clause = ", ".join(f"{key} = %s" for key, _ in items)
    values = [value for _, value in items]
    execute(f"UPDATE projects SET {set_clause} WHERE project_id = %s", (*values, project_id))


def delete_project(project_id: int) -> None:
    execute("DELETE FROM projects WHERE project_id = %s", (project_id,))


def get_project(project_id: int) -> Optional[dict[str, Any]]:
    return fetch_one("SELECT * FROM projects WHERE project_id = %s", (project_id,))


def list_projects() -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM projects ORDER BY project_id DESC")


def assign_employee_to_project(employee_id: int, project_id: int, assigned_date: str = "") -> int:
    return execute(
        """
        INSERT INTO employee_projects (employee_id, project_id, assigned_date)
        VALUES (%s, %s, %s)
        """,
        (employee_id, project_id, assigned_date or None),
    )


def list_employee_projects() -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM employee_projects ORDER BY id DESC")


RAW_SQL_EXAMPLES = {
    "create": "CREATE TABLE departments (department_id INT AUTO_INCREMENT PRIMARY KEY, department_name VARCHAR(100) NOT NULL, location VARCHAR(100))",
    "insert": "INSERT INTO employees (employee_name, email, phone, salary, joining_date, department_id, status) VALUES ('John Doe', 'john@example.com', '01700000000', 70000, '2024-01-01', 1, 1)",
    "select": "SELECT * FROM employees WHERE salary > 50000",
    "update": "UPDATE employees SET salary = salary + 1000 WHERE department_id = 1",
    "delete": "DELETE FROM employees WHERE employee_id = 1",
}


if __name__ == "__main__":
    init_db()
    print(f"Database ready: {DB_NAME} on {DB_HOST}:{DB_PORT}")