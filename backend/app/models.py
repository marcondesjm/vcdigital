from pydantic import BaseModel, EmailStr
from typing import Optional, List

class ClientCreate(BaseModel):
    name: str
    document: str

class UserLogin(BaseModel):
    email: str
    password: str

class EmployeeCreate(BaseModel):
    tenant_id: Optional[str] = None
    name: str
    email: str
    password: str
    role: str = "operator" # admin ou operator

class AuditLogCreate(BaseModel):
    certificate_id: str
    employee_id: str
    document_name: str
    document_hash: str
    action: str = "SIGNATURE"
    status: str = "SUCCESS"

class PermissionGrant(BaseModel):
    employee_id: str
    certificate_id: str
