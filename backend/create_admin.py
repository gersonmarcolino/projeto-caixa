import app.models  # noqa: F401

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User, UserRole

db = SessionLocal()

tenant = Tenant(name="Escola Teste", slug="escola-teste")
db.add(tenant)
db.flush()

user = User(
    tenant_id=tenant.id,
    name="Admin",
    email="admin@teste.com",
    hashed_password=hash_password("admin123"),
    role=UserRole.super_admin,
)
db.add(user)
db.commit()

print(f"Tenant criado: {tenant.name}")
print(f"Usuário criado: {user.email} / senha: admin123")
db.close()
