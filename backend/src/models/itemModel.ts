export interface Item {
  id: string;
  name: string;
  category: string;
  status: 'Active' | 'Pending' | 'Disabled';
  createdAt: Date;
}
