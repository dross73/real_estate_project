# Purpose:
#   Provide a single Declarative Base class for all SQLAlchemy models.
#
# Why:
#   Centralizing the Base avoids circular imports and keeps session setup
#   separate from model declarations.
#
# SQLAlchemy 2.0 note:
#   DeclarativeBase is the modern way to define the Base class.

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
