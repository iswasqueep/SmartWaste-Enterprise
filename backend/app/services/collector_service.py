from datetime import datetime


def generate_collector_code(user_id):
    year = datetime.now().year
    return f"COL-{year}-{user_id:05d}"