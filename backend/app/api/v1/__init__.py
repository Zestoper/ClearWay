from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, flights, bookings, admin, notices, csevice, users, nextrip, chat, reviews

api_router = APIRouter()
api_router.include_router(health.router,    prefix="/health",   tags=["health"])
api_router.include_router(auth.router,      prefix="/auth",     tags=["auth"])
api_router.include_router(users.router,     prefix="/users",    tags=["users"])
api_router.include_router(flights.router,   prefix="/flights",  tags=["flights"])
api_router.include_router(bookings.router,  prefix="/bookings", tags=["bookings"])
api_router.include_router(admin.router,     prefix="/admin",    tags=["admin"])
api_router.include_router(notices.router,   prefix="/notices",  tags=["notices"])
api_router.include_router(csevice.router,   prefix="/cs",       tags=["customer-service"])
api_router.include_router(nextrip.router,   prefix="/nextrip",  tags=["nextrip"])
api_router.include_router(chat.router,      prefix="/chat",     tags=["chat"])
api_router.include_router(reviews.router,   prefix="/reviews",  tags=["reviews"])
