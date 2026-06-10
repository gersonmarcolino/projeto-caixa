"""
Cria o tenant inicial e um usuário super_admin.
Uso: python seed.py
"""
import sys
from dotenv import load_dotenv

load_dotenv()

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User, UserRole

TENANT_NAME = "Escola Demo"
TENANT_SLUG = "escola-demo"
ADMIN_NAME = "Administrador"
ADMIN_EMAIL = "admin@cafeteria.com"
ADMIN_PASSWORD = "admin123"


def seed():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if existing:
            print(f"Usuário {ADMIN_EMAIL} já existe. Nada foi criado.")
            return

        tenant = Tenant(name=TENANT_NAME, slug=TENANT_SLUG)
        db.add(tenant)
        db.flush()

        user = User(
            tenant_id=tenant.id,
            name=ADMIN_NAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            role=UserRole.super_admin,
        )
        db.add(user)
        db.commit()

        print("Seed concluído!")
        print(f"  Tenant : {TENANT_NAME} ({TENANT_SLUG})")
        print(f"  Email  : {ADMIN_EMAIL}")
        print(f"  Senha  : {ADMIN_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
