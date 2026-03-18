// Types
export interface ApexPartResult {
  id: string;
  sku: string;
  name: string;
  brand: string;
  family: string;
  category: string;
  subcategory: string;
  oem_number: string | null;
  sell_price: number;      // in pesos (decimal)
  cost_price: number;      // in pesos (decimal)
  stock: {
    total: number;
    by_location: Record<string, number>;
  };
}

export interface ApexSearchResponse {
  results: ApexPartResult[];
  total: number;
  has_more: boolean;
}

// Get Apex POS config from environment
function getConfig() {
  const apiUrl = process.env.APEX_POS_API_URL || "";
  const apiKey = process.env.APEX_POS_API_KEY || "";
  return { apiUrl, apiKey };
}

// Search parts in Apex POS catalog
export async function searchParts(
  query: string,
  options?: {
    limit?: number;
    categoryId?: string;
    inStock?: boolean;
  }
): Promise<ApexSearchResponse> {
  const { apiUrl, apiKey } = getConfig();

  if (!apiUrl || !apiKey) {
    return { results: [], total: 0, has_more: false };
  }

  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(options?.limit ?? 20),
    });
    if (options?.categoryId) params.set("categoryId", options.categoryId);
    if (options?.inStock) params.set("inStock", "true");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`${apiUrl}/api/v1/catalog/search?${params}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`Apex POS API error: ${res.status} ${res.statusText}`);
      return { results: [], total: 0, has_more: false };
    }

    const data = await res.json();

    // Map the response to our interface
    // Apex POS may return data in various formats, normalize here
    const results: ApexPartResult[] = (data.results || data.data || []).map((item: any) => ({
      id: item.id || item.product_id || "",
      sku: item.sku || "",
      name: item.name || item.product_name || "",
      brand: item.brand || item.brand_name || "",
      family: item.family || "",
      category: item.category || item.category_name || "",
      subcategory: item.subcategory || item.subcategory_name || "",
      oem_number: item.oem_number || item.oem || null,
      sell_price: Number(item.sell_price || item.price || 0),
      cost_price: Number(item.cost_price || item.cost || 0),
      stock: {
        total: Number(item.stock?.total ?? item.total_stock ?? 0),
        by_location: item.stock?.by_location || {},
      },
    }));

    return {
      results,
      total: data.total || results.length,
      has_more: data.has_more || false,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Apex POS API timeout");
    } else {
      console.error("Apex POS API error:", error);
    }
    return { results: [], total: 0, has_more: false };
  }
}

// Get a single part by ID
export async function getPartById(id: string): Promise<ApexPartResult | null> {
  const { apiUrl, apiKey } = getConfig();
  if (!apiUrl || !apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${apiUrl}/api/v1/catalog/products/${id}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const item = await res.json();
    return {
      id: item.id || "",
      sku: item.sku || "",
      name: item.name || "",
      brand: item.brand || "",
      family: item.family || "",
      category: item.category || "",
      subcategory: item.subcategory || "",
      oem_number: item.oem_number || null,
      sell_price: Number(item.sell_price || 0),
      cost_price: Number(item.cost_price || 0),
      stock: {
        total: Number(item.stock?.total ?? 0),
        by_location: item.stock?.by_location || {},
      },
    };
  } catch {
    return null;
  }
}

// Test connection to Apex POS
export async function testConnection(): Promise<{ success: boolean; productCount?: number; error?: string }> {
  const { apiUrl, apiKey } = getConfig();
  if (!apiUrl) return { success: false, error: "API URL not configured" };
  if (!apiKey) return { success: false, error: "API key not configured" };

  try {
    const result = await searchParts("test", { limit: 1 });
    return { success: true, productCount: result.total };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed"
    };
  }
}
