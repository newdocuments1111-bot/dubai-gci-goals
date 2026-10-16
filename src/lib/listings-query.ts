import { queryOptions } from '@tanstack/react-query';
import { getListings } from './listings.functions';
export const listingsQuery = queryOptions({ queryKey: ['private-listings'], queryFn: () => getListings(), staleTime: 0, refetchInterval: 60000 });