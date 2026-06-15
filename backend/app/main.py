from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, categories, customers, print_jobs, products, sales

app = FastAPI(title="Cafeteria SaaS API", version="0.1.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(print_jobs.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
