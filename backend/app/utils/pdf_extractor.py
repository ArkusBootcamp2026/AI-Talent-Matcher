"""PDF text extraction utility"""

import logging
from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Try to import PyMuPDF as fallback
try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logger.warning("PyMuPDF (fitz) not available. Install with: pip install pymupdf")


def extract_text_from_pdf(pdf_content: bytes) -> str:
    """
    Extract text from PDF content.
    
    Handles malformed PDFs with missing font descriptors or other issues
    by using fallback extraction methods and per-page error handling.
    
    Args:
        pdf_content: PDF file content as bytes
        
    Returns:
        Extracted text as a single string
        
    Raises:
        ValueError: If text extraction fails completely
    """
    from io import BytesIO
    
    pdf_file = BytesIO(pdf_content)
    
    # Try original simple extraction first (like cv-parser original)
    # But handle bbox errors gracefully by using strict=False if needed
    try:
        # First, try to extract first page to detect if we need strict=False
        reader = PdfReader(pdf_file)
        use_strict_false = False
        
        # Check if first page can be extracted with standard reader
        try:
            test_page = reader.pages[0]
            test_text = test_page.extract_text() or ""
            if not test_text.strip():
                # Empty text - might need strict=False
                logger.debug("First page extracted but empty, trying strict=False...")
                use_strict_false = True
        except (KeyError, AttributeError) as e:
            error_msg = str(e)
            if "bbox" in error_msg.lower() or "font" in error_msg.lower():
                logger.warning(
                    f"First page extraction error (bbox/font): {error_msg}. "
                    "Will use strict=False for entire document..."
                )
                use_strict_false = True
        except Exception as e:
            logger.warning(f"Unexpected error testing first page: {str(e)}. Will use strict=False...")
            use_strict_false = True
        
        # Extract all pages with appropriate reader
        if use_strict_false:
            pdf_file.seek(0)
            reader = PdfReader(pdf_file, strict=False)
        
        texts = []
        first_page_failed = False
        for i, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    texts.append(page_text)
                elif i == 0:
                    # First page extracted but empty
                    first_page_failed = True
            except Exception as page_error:
                error_msg = str(page_error)
                if i == 0:
                    # First page failed - this is critical
                    first_page_failed = True
                    logger.error(
                        f"CRITICAL: First page extraction failed even with strict=False: {error_msg}. "
                        "Will try PyMuPDF fallback if available."
                    )
                else:
                    logger.warning(
                        f"Error extracting page {i + 1}: {error_msg}. "
                        "Skipping this page."
                    )
        
        # If first page failed, try PyMuPDF as fallback
        if first_page_failed and PYMUPDF_AVAILABLE:
            logger.warning("Attempting to extract first page using PyMuPDF fallback...")
            try:
                pdf_file.seek(0)
                doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
                if len(doc) > 0:
                    first_page = doc[0]
                    first_page_text = first_page.get_text()
                    if first_page_text.strip():
                        # Replace or prepend first page text
                        if texts and len(texts) > 0:
                            texts[0] = first_page_text  # Replace what we got from page 2
                        else:
                            texts.insert(0, first_page_text)  # Insert as first
                        logger.info(f"First page extracted using PyMuPDF fallback")
                        
                        # Also extract remaining pages with PyMuPDF for consistency
                        for i in range(1, len(doc)):
                            try:
                                page_text = doc[i].get_text()
                                if page_text.strip():
                                    if i < len(texts):
                                        texts[i] = page_text
                                    else:
                                        texts.append(page_text)
                            except Exception as e:
                                logger.warning(f"PyMuPDF: Error extracting page {i + 1}: {str(e)}")
                    doc.close()
            except Exception as pymupdf_error:
                logger.error(f"PyMuPDF fallback also failed: {str(pymupdf_error)}")
        elif first_page_failed and not PYMUPDF_AVAILABLE:
            logger.error(
                "First page extraction failed and PyMuPDF is not available. "
                "Install PyMuPDF for better PDF handling: pip install pymupdf"
            )
        
        if texts:
            full_text = "\n".join(texts)
            logger.info(f"Extracted {len(texts)} pages, {len(full_text)} characters")
            return full_text
        else:
            raise ValueError(
                "No text could be extracted from any page of the PDF. "
                "The PDF may be corrupted, password-protected, or contain only images."
            )
            
    except ValueError as e:
        # Re-raise ValueError as-is (already has user-friendly message)
        raise
    except Exception as e:
        # If reader initialization fails, try with strict=False
        error_message = str(e)
        if "bbox" in error_message.lower() or "font" in error_message.lower() or isinstance(e, (KeyError, AttributeError)):
            logger.warning(
                f"PDF reader initialization error (likely font/bbox issue): {error_message}. "
                "Retrying entire document with strict=False..."
            )
            
            try:
                pdf_file.seek(0)
                reader = PdfReader(pdf_file, strict=False)
                texts = []
                
                for i, page in enumerate(reader.pages):
                    try:
                        page_text = page.extract_text() or ""
                        if page_text.strip():
                            texts.append(page_text)
                    except Exception as page_error:
                        logger.warning(
                            f"Error extracting page {i + 1} even with strict=False: {str(page_error)}. "
                            "Skipping this page."
                        )
                
                if texts:
                    full_text = "\n".join(texts)
                    logger.info(f"Extracted {len(texts)} pages using strict=False, {len(full_text)} characters")
                    return full_text
                else:
                    raise ValueError(
                        "No text could be extracted from any page of the PDF. "
                        "The PDF may be corrupted, password-protected, or contain only images."
                    )
            except Exception as fallback_error:
                logger.error(f"Fallback extraction also failed: {str(fallback_error)}")
                raise ValueError(
                    "The PDF file has formatting issues that prevent text extraction. "
                    "Please try converting the PDF to a newer format or use a different PDF file."
                )
        else:
            # Re-raise if it's not a bbox/font error
            raise
    except Exception as e:
        error_message = str(e)
        logger.error(f"PDF extraction error: {error_message}")
        
        # Provide user-friendly error message
        if "password" in error_message.lower() or "encrypted" in error_message.lower():
            raise ValueError(
                "The PDF file is password-protected. "
                "Please remove the password and try again."
            )
        else:
            raise ValueError(
                f"Failed to extract text from PDF: {error_message}. "
                "The PDF may be corrupted or in an unsupported format. "
                "Please try with a different PDF file."
            )
