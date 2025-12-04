# ===============================
# AUTHENTICATION ROUTE IMPORTS
# ===============================

# FastAPI tools for building routes, handling dependencies, and raising errors
from fastapi import APIRouter, Depends, HTTPException, status

# Provides a standardized way to accept username/password from login forms
from fastapi.security import OAuth2PasswordRequestForm

# Database session management
from sqlalchemy.orm import Session

# Data validation and serialization for our token response
from pydantic import BaseModel

# Security utilities for hashing and JWT creation
from app.core.security import verify_password, create_access_token

# Dependency that provides a database session
from app.db.session import get_db

# The User model used to query login credentials
from app.db.models import User

# Import Role model to look up and assign user roles
from app.db.models import Role

# ===============================
# ADDITIONAL IMPORTS FOR REGISTER
# ===============================

# Import the user creation schema and read schema for response serialization
from app.schemas.user import UserCreate, UserRead

# Import your password hashing helper
from app.core.security import get_password_hash


# ===============================
# TOKEN RESPONSE MODEL
# ===============================


# Why this model exists:
# It defines the shape of the response returned after a successful login.
# Returning a Pydantic model ensures FastAPI automatically documents the schema in Swagger.
class TokenResponse(BaseModel):
    # The signed JWT token string
    access_token: str

    # The token type (usually "bearer" for Authorization header use)
    token_type: str = "bearer"


# ===============================
# ROUTER SETUP
# ===============================

# Why APIRouter is used:
# It keeps authentication endpoints modular and easily imported into main.py.
router = APIRouter(prefix="/auth", tags=["auth"])

# ===============================
# LOGIN ROUTE
# ===============================


# Why this endpoint exists:
# It verifies user credentials and returns a signed JWT access token if valid.
@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(
    # Why we use Depends() with OAuth2PasswordRequestForm:
    # It automatically extracts "username" and "password" from form data.
    form_data: OAuth2PasswordRequestForm = Depends(),
    # Why we use Depends() with get_db:
    # Provides a database session to perform user lookup.
    db: Session = Depends(get_db),
) -> TokenResponse:
    # Query the database for the user by email (used as the "username" field)
    user = db.query(User).filter(User.email == form_data.username).first()

    # Security best practice: do not reveal whether the email or password failed
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create an access token that includes both the email (subject)
    # and the role (admin, staff, etc.) for role-based access control.
    access_token = create_access_token(
        subject=user.email,
        role=str(user.role),  # NEW: embed role into JWT payload
        expires_delta=None,  # uses default expiry from settings
    )

    # Return the signed JWT and token type
    return TokenResponse(access_token=access_token, token_type="bearer")


# ===============================
# USER REGISTRATION ROUTE
# ===============================


# Why this endpoint exists:
# It allows new users to register by providing their email and password.
# The password is securely hashed before being saved in the database.
@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(
    # Why we accept a UserCreate model:
    # It validates incoming data and ensures required fields (email, password) are present.
    user_in: UserCreate,
    # Why we depend on a database session:
    # Needed to insert the new user record and check for duplicates.
    db: Session = Depends(get_db),
):
    # Why we check for duplicates first:
    # Prevents two accounts from registering with the same email address.
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    # Why we hash the password:
    # Plaintext passwords are never stored — only bcrypt hashes.
    hashed_password = get_password_hash(user_in.password)

    # Why we create a new User object:
    # Maps validated Pydantic data to our SQLAlchemy model for insertion.
    new_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed_password,
    )

    # If the request includes role IDs, assign those roles to the new user
    if user_in.role_ids:
        # Query the Role table for all matching role IDs
        roles = db.query(Role).filter(Role.id.in_(user_in.role_ids)).all()

        # Assign the found Role objects to the user's relationaship
        new_user.roles = roles

    # Why we add and commit:
    # Adds the user to the database and commits the transaction.
    db.add(new_user)
    db.commit()

    # Refresh ensures we get the auto-generated ID and timestamps.
    db.refresh(new_user)

    # Why we return the created user:
    # The response model (UserRead) automatically hides sensitive fields.
    return new_user
