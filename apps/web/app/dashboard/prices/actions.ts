"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createProtectedSdkOptions } from "../../../lib/sdk/protected";

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

function redirectToPrices() {
  revalidatePath("/dashboard/prices");
  redirect("/dashboard/prices");
}

export async function submitPriceIntake(_formData: FormData) {
  requireProtectedOptions();
  throw new Error("Price intake endpoint has been removed from the API.");
}

export async function reconcilePriceItem(_formData: FormData) {
  requireProtectedOptions();
  throw new Error("Price reconciliation endpoint has been removed from the API.");
}

export async function classifyPriceItem(_formData: FormData) {
  requireProtectedOptions();
  throw new Error("Price classification endpoint has been removed from the API.");
}

export async function promotePriceItem(_formData: FormData) {
  requireProtectedOptions();
  throw new Error("Price promotion endpoint has been removed from the API.");
}
