import { prisma } from "../../lib/prisma.js";
import tenantService from "../tenant/tenant.service.js";
import { catchAsync } from "../../shared/utils/catchAsync.js";
import { AppError, ForbiddenError, NotFoundError } from "../../shared/utils/errors.js";
import { getBusinessCapabilitiesFromLicense } from "../license/license.service.js";
import type { PurchaseDocumentType } from "./purchases.types.js";

type PurchaseAccessDeps = {
  validateMembership: typeof tenantService.validateMembership;
  getCapabilities: typeof getBusinessCapabilitiesFromLicense;
};

const PURCHASE_DOCUMENT_META: Record<
  PurchaseDocumentType,
  {
    singularLabel: string;
  }
> = {
  PURCHASE_ORDER: {
    singularLabel: "purchase order",
  },
  GOODS_RECEIPT_NOTE: {
    singularLabel: "goods receipt note",
  },
  PURCHASE_INVOICE: {
    singularLabel: "purchase invoice",
  },
  PURCHASE_RETURN: {
    singularLabel: "purchase return",
  },
};

export const getPurchaseCapabilityRequired = (documentType: PurchaseDocumentType) =>
  documentType === "PURCHASE_RETURN" ? "TXN_PURCHASE_RETURN" : "TXN_PURCHASE_CREATE";

export const assertPurchaseAccess = async (
  userId: string,
  tenantId: string,
  documentType: PurchaseDocumentType,
  deps: PurchaseAccessDeps = {
    validateMembership: tenantService.validateMembership,
    getCapabilities: getBusinessCapabilitiesFromLicense,
  },
) => {
  const member = await deps.validateMembership(userId, tenantId);
  if (!member) {
    throw new ForbiddenError("Access denied");
  }

  const capabilities = await deps.getCapabilities(tenantId);
  const requiredCapabilities = [
    "PARTIES_SUPPLIERS",
    getPurchaseCapabilityRequired(documentType),
  ] as const;

  if (!requiredCapabilities.every((capability) => capabilities.includes(capability))) {
    throw new ForbiddenError(
      `${PURCHASE_DOCUMENT_META[documentType].singularLabel} workflow is not enabled for this store license`,
    );
  }
};

const getPurchaseDocumentTypeOrThrow = async (
  tenantId: string,
  documentId: string,
): Promise<PurchaseDocumentType> => {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      business_id: tenantId,
      deleted_at: null,
      type: {
        in: [
          "PURCHASE_ORDER",
          "GOODS_RECEIPT_NOTE",
          "PURCHASE_INVOICE",
          "PURCHASE_RETURN",
        ],
      },
    },
    select: {
      type: true,
    },
  });

  if (!document) {
    throw new NotFoundError("Purchase document not found");
  }

  return document.type as PurchaseDocumentType;
};

const throwPurchaseNotImplemented = (): never => {
  throw new AppError("Purchase document workflow is not implemented yet", 501);
};

export const listPurchaseDocuments = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.query as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const getPurchaseDocumentHistory = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.query as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const getPurchaseConversionBalance = catchAsync(async (req, res) => {
  const { tenantId } = req.query as {
    tenantId: string;
  };
  const { documentId } = req.params as {
    documentId: string;
  };

  const documentType = await getPurchaseDocumentTypeOrThrow(tenantId, documentId);
  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const createPurchaseDocument = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const updatePurchaseDocument = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const postPurchaseDocument = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const transitionPurchaseDocument = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});

export const deletePurchaseDocument = catchAsync(async (req, res) => {
  const { tenantId, documentType } = req.body as {
    tenantId: string;
    documentType: PurchaseDocumentType;
  };

  await assertPurchaseAccess(req.user.id, tenantId, documentType);
  void res;
  throwPurchaseNotImplemented();
});
