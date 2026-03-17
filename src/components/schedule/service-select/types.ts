export interface CatalogService {
  id: string;
  name: string;
  category: string;
  description: string | null;
  defaultEstimatedHours: number;
}
