export interface Media {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: Date;
  updatedAt: Date;
}
