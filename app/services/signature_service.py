"""
Serviço responsável por realizar assinaturas digitais qualificadas
seguindo o padrão PAdES (ICP-Brasil).
Opera 100% em memória (BytesIO) — nunca grava PFX/senha em disco.
"""

import io
import os
from typing import Optional, Tuple, Dict, Any

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.serialization import pkcs12, Encoding, PrivateFormat, NoEncryption
from pyhanko.keys import load_private_key_from_pemder_data, load_certs_from_pemder_data
from pyhanko.sign.signers import SimpleSigner, PdfSigner, PdfSignatureMetadata
from pyhanko_certvalidator.registry import SimpleCertificateStore
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter


def extract_pfx_metadata(pfx_bytes: bytes, password: bytes) -> Dict[str, Any]:
    metadata = {
        "expiry_date": None,
        "subject_cn": None,
        "issuer_cn": None,
        "key_size": None,
        "key_type": None,
    }

    try:
        loaded = pkcs12.load_key_and_certificates(pfx_bytes, password)

        if loaded[0] is not None:
            key = loaded[0]
            metadata["key_size"] = key.key.size * 8 if hasattr(key.key, 'size') else None
            metadata["key_type"] = type(key.key).__name__.lower()

        if len(loaded) > 1 and loaded[1] is not None:
            cert = loaded[1]

            if hasattr(cert, 'not_valid_after'):
                metadata["expiry_date"] = cert.not_valid_after.isoformat() if cert.not_valid_after else None

            subject = cert.subject
            for component in subject:
                if component.oid._name == 'commonName':
                    metadata["subject_cn"] = component.value

            issuer = cert.issuer
            for component in issuer:
                if component.oid._name == 'commonName':
                    metadata["issuer_cn"] = component.value

    except Exception:
        pass

    return metadata


async def sign_pdf_a1(
    pdf_bytes: bytes,
    pfx_bytes: bytes,
    password: bytes,
    field_name: str = "Signature1"
) -> Tuple[Optional[bytes], str, Dict[str, Any]]:
    """
    Realiza a assinatura PAdES de um PDF usando certificado A1 (.pfx).
    Função assíncrona — usa async_sign_pdf para evitar asyncio.run().
    """
    pwd = password.encode() if isinstance(password, str) else password
    metadata = extract_pfx_metadata(pfx_bytes, pwd)

    try:
        key, cert, others = pkcs12.load_key_and_certificates(pfx_bytes, pwd)

        if key is None or cert is None:
            return None, "Certificado ou chave privada não encontrados no PFX.", metadata

        key_pem = key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
        cert_pem = cert.public_bytes(Encoding.PEM)

        asn1_key = load_private_key_from_pemder_data(key_pem, passphrase=None)
        asn1_cert = list(load_certs_from_pemder_data(cert_pem))[0]

        store = SimpleCertificateStore()
        store.register(asn1_cert)

        if others:
            for oc in others:
                try:
                    oc_pem = oc.public_bytes(Encoding.PEM)
                    for parsed_oc in load_certs_from_pemder_data(oc_pem):
                        store.register(parsed_oc)
                except Exception:
                    pass

        signer = SimpleSigner(
            signing_key=asn1_key,
            signing_cert=asn1_cert,
            cert_registry=store
        )

        from pyhanko.sign.fields import SigFieldSpec
        from pyhanko.sign import fields

        # Configurar metadados e carimbo visual da assinatura
        sig_meta = PdfSignatureMetadata(
            field_name=field_name,
            reason="Documento assinado digitalmente com validade jurídica (ICP-Brasil)",
            location="Brasil",
            contact_info="suporte@vocedigital.app",
        )

        w = IncrementalPdfFileWriter(io.BytesIO(pdf_bytes))

        # Adicionar campo de assinatura visível na última página (canto inferior esquerdo)
        fields.append_signature_field(
            w,
            sig_field_spec=SigFieldSpec(
                sig_field_name=field_name,
                box=(100, 100, 400, 150),  # Coordenadas (x1, y1, x2, y2)
            ),
        )

        with io.BytesIO() as outf:
            pdf_signer = PdfSigner(
                sig_meta,
                signer=signer,
            )
            await pdf_signer.async_sign_pdf(w, output=outf, existing_fields_only=False)
            signed_pdf_bytes = outf.getvalue()

        return signed_pdf_bytes, "Documento assinado com sucesso!", metadata

    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"Erro na assinatura: {str(e)}", metadata


def sign_pdf_a3(
    pdf_bytes: bytes,
    token_id: str,
    token_library_path: Optional[str] = None
) -> Tuple[Optional[bytes], str, Dict[str, Any]]:
    metadata = {"token_id": token_id, "library_path": token_library_path or "default"}

    try:
        from PyKCS11 import PyKCS11, PyKCS11Error

        lib_path = token_library_path or os.getenv("PYKCS11_LIBRARY_PATH", "")
        if not lib_path:
            return None, "Caminho da biblioteca PKCS#11 não especificado.", metadata

        pkcs11_lib = PyKCS11(lib_path)
        slot_id = 0
        session_id = pkcs11_lib.C_OpenSlot(slot_id)
        if session_id is None:
            return None, "Nenhum token encontrado no slot 0.", metadata

        return None, "Assinatura A3 não totalmente implementada neste build.", metadata

    except ImportError:
        return None, "Biblioteca PyKCS11 não instalada.", metadata
    except Exception as e:
        return None, f"Erro na assinatura A3: {str(e)}", metadata
