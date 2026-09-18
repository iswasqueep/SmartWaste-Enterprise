from app import create_app
from app.extensions import db
from app.models import ApprovalStatus, Role, User, Vehicle, WasteCategory

app = create_app()

with app.app_context():
    categories = [
        ("General Waste", False, 100, "Non-recyclable household and commercial waste"),
        ("Plastic", True, 80, "Plastic bottles, containers and packaging"),
        ("Paper", True, 60, "Paper, cartons and cardboard"),
        ("Glass", True, 90, "Glass bottles and jars"),
        ("Organic Waste", True, 50, "Food scraps and compostable garden waste"),
        ("Electronic Waste", True, 250, "Discarded electrical and electronic equipment"),
    ]

    for name, recyclable, price, description in categories:
        category = WasteCategory.query.filter_by(name=name).first()

        if not category:
            db.session.add(
                WasteCategory(
                    name=name,
                    recyclable=recyclable,
                    price_per_kg=price,
                    description=description,
                )
            )

    admin = User.query.filter_by(email="admin@smartwaste.local").first()

    if not admin:
        admin = User(
            full_name="SmartWaste Administrator",
            email="admin@smartwaste.local",
            role=Role.ADMIN.value,
            approval_status=ApprovalStatus.APPROVED.value,
            is_active=True,
        )
        admin.set_password("Admin123!")
        db.session.add(admin)

    if not Vehicle.query.filter_by(registration_number="LAG-SW-001").first():
        db.session.add(
            Vehicle(
                registration_number="LAG-SW-001",
                vehicle_type="Compactor Truck",
                capacity_kg=5000,
            )
        )

    db.session.commit()

    print("Database seeded successfully.")
    print("Initial administrator: admin@smartwaste.local / Admin123!")
    print("Customers, collectors, recycling companies and government users must register through the portal.")
