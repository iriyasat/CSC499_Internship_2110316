import datetime

def parse_saledate(date_str):
    """
    Parses different date formats, specifically the standard format:
    'Tue Dec 16 2014 12:30:00 GMT-0800 (PST)'
    """
    if not date_str:
        return None
    date_str = date_str.strip()
    
    # Try parsing GMT-0800 format
    parts = date_str.split()
    if len(parts) >= 5:
        # Reconstruct "Dec 16 2014 12:30:00"
        clean_str = f"{parts[1]} {parts[2]} {parts[3]} {parts[4]}"
        try:
            return datetime.datetime.strptime(clean_str, "%b %d %Y %H:%M:%S")
        except ValueError:
            pass
            
    # Try common ISO or other formats as fallbacks
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y %H:%M", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(date_str, fmt)
        except ValueError:
            continue
            
    return None

def clean_row(row):
    """
    Validates and cleans a row of vehicle sales data.
    Returns the cleaned row dict, or None if the row is invalid or has missing data.
    """
    # 1. Check for missing/empty values or placeholders like '—'
    missing_placeholders = {'', '—', 'null', 'nan', 'none', 'n/a', 'na', '-', 'undefined'}
    
    # Inspect all cells in row
    for col, val in row.items():
        if val is None:
            return None
        val_str = str(val).strip()
        if not val_str or val_str.lower() in missing_placeholders:
            return None

    # Cleaned dictionary to build
    cleaned = {}

    # 2. Parse and validate fields
    # Year
    try:
        year_val = int(row['year'].strip())
        # Validate realistic year range
        if year_val < 1900 or year_val > datetime.datetime.now().year + 2:
            return None
        cleaned['year'] = year_val
    except ValueError:
        return None

    # Strings
    cleaned['make'] = row['make'].strip().title()
    cleaned['model'] = row['model'].strip().title()
    cleaned['trim'] = row['trim'].strip() # Keep trim casing as is
    cleaned['body'] = row['body'].strip().title()
    
    # Transmission
    trans = row['transmission'].strip().lower()
    if 'auto' in trans:
        cleaned['transmission'] = 'automatic'
    elif 'man' in trans:
        cleaned['transmission'] = 'manual'
    else:
        # Invalid transmission value
        return None

    # VIN (Vehicle Identification Number)
    vin = row['vin'].strip().upper()
    if len(vin) < 5 or not vin.isalnum():
        return None
    cleaned['vin'] = vin

    # State
    cleaned['state'] = row['state'].strip().upper()

    # Condition (float value between 0 and 50)
    try:
        cond = float(row['condition'].strip())
        if cond < 0 or cond > 50:
            return None
        cleaned['condition'] = cond
    except ValueError:
        return None

    # Odometer
    try:
        odo = int(row['odometer'].strip())
        if odo < 0:
            return None
        cleaned['odometer'] = odo
    except ValueError:
        return None

    # Colors
    cleaned['color'] = row['color'].strip().title()
    cleaned['interior'] = row['interior'].strip().title()
    cleaned['seller'] = row['seller'].strip()

    # MMR (Manheim Market Report price estimate)
    try:
        mmr = int(row['mmr'].strip())
        if mmr < 0:
            return None
        cleaned['mmr'] = mmr
    except ValueError:
        return None

    # Selling Price
    try:
        sp = int(row['sellingprice'].strip())
        if sp < 0:
            return None
        cleaned['sellingprice'] = sp
    except ValueError:
        return None

    # Sale Date
    dt = parse_saledate(row['saledate'])
    if dt is None:
        return None
    cleaned['saledate_obj'] = dt
    # Store formatted string directly in 'saledate' for VARCHAR database column
    cleaned['saledate'] = dt.strftime("%d-%m-%Y,%A")

    return cleaned
