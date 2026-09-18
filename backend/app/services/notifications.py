from ..extensions import db
from ..models import Notification


def notify(user_id: int, title: str, message: str):
    notification = Notification(user_id=user_id, title=title, message=message)
    db.session.add(notification)
    return notification
