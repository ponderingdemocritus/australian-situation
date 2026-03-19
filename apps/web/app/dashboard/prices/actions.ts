"use server";

import {
  postApiPricesIntakeBatches,
  postApiPricesUnresolvedItemsByIdClassify,
  postApiPricesUnresolvedItemsByIdPromote,
  postApiPricesUnresolvedItemsByIdReconcile
} from "@aus-dash/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProtectedSdkOptions } from "../../../lib/sdk/protected";
import { unwrapSdkData } from "../../../lib/sdk/unwrap";

function requireProtectedOptions() {
  const options = createProtectedSdkOptions();
  if (!options) {
    throw new Error("Protected price credentials are not configured.");
  }

  return options;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requiredString(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) {
    throw new Error(`Missing required field: ${key}`);
  }

  return value;
}

function optionalBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function redirectToPrices() {
  revalidatePath("/dashboard/prices");
  redirect("/dashboard/prices");
}

export async function submitPriceIntake(formData: FormData) {
  const options = requireProtectedOptions();

  const response = await postApiPricesIntakeBatches({
    ...options,
    body: {
      sourceId: requiredString(formData, "sourceId"),
      items: [
        {
          observedAt: requiredString(formData, "observedAt"),
          merchantName: requiredString(formData, "merchantName"),
          regionCode: requiredString(formData, "regionCode"),
          title: requiredString(formData, "title"),
          externalOfferId: requiredString(formData, "externalOfferId"),
          priceAmount: Number(requiredString(formData, "priceAmount")),
          categoryHint: optionalString(formData, "categoryHint"),
          listingUrl: optionalString(formData, "listingUrl"),
          normalizedUnit: optionalString(formData, "normalizedUnit")
        }
      ]
    }
  });

  unwrapSdkData(response);
  redirectToPrices();
}

export async function reconcilePriceItem(formData: FormData) {
  const options = requireProtectedOptions();
  const id = requiredString(formData, "unresolvedItemId");

  const response = await postApiPricesUnresolvedItemsByIdReconcile({
    ...options,
    body: {
      canonicalCategorySlug: requiredString(formData, "canonicalCategorySlug"),
      canonicalCategoryName: requiredString(formData, "canonicalCategoryName"),
      canonicalProductSlug: requiredString(formData, "canonicalProductSlug"),
      canonicalProductName: requiredString(formData, "canonicalProductName"),
      notes: optionalString(formData, "notes")
    },
    path: { id }
  });

  unwrapSdkData(response);
  redirectToPrices();
}

export async function classifyPriceItem(formData: FormData) {
  const options = requireProtectedOptions();
  const id = requiredString(formData, "unresolvedItemId");

  const response = await postApiPricesUnresolvedItemsByIdClassify({
    ...options,
    body: {
      aiExposureLevel: optionalString(formData, "aiExposureLevel") as
        | "high"
        | "low"
        | "medium"
        | undefined,
      aiExposureReason: optionalString(formData, "aiExposureReason"),
      comparableUnitBasis: optionalString(formData, "comparableUnitBasis"),
      countryOfOrigin: optionalString(formData, "countryOfOrigin"),
      domesticValueShareBand: optionalString(formData, "domesticValueShareBand"),
      isAustralianMade: optionalBoolean(formData, "isAustralianMade"),
      isControlCandidate: optionalBoolean(formData, "isControlCandidate"),
      manufacturerName: optionalString(formData, "manufacturerName"),
      productFamilySlug: optionalString(formData, "productFamilySlug")
    },
    path: { id }
  });

  unwrapSdkData(response);
  redirectToPrices();
}

export async function promotePriceItem(formData: FormData) {
  const options = requireProtectedOptions();
  const id = requiredString(formData, "unresolvedItemId");

  const response = await postApiPricesUnresolvedItemsByIdPromote({
    ...options,
    path: { id }
  });

  unwrapSdkData(response);
  redirectToPrices();
}
