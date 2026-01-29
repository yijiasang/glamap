import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type errorSchemas } from "@shared/routes";
import type { InsertProfile, InsertService, InsertReview, Profile, Service, Review } from "@shared/schema";
import { z } from "zod";
import { useAuth } from "./use-auth";

// --- Profiles ---

export function useProfiles(filters?: { services?: string[]; locationTypes?: string[]; search?: string; lat?: number; lng?: number; radius?: number }) {
  return useQuery({
    queryKey: [api.profiles.list.path, filters],
    queryFn: async () => {
      const url = new URL(api.profiles.list.path, window.location.origin);
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => url.searchParams.append(key, v));
            } else {
              url.searchParams.append(key, String(value));
            }
          }
        });
      }
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profiles");
      return api.profiles.list.responses[200].parse(await res.json());
    },
  });
}

export function useProfile(id: number) {
  return useQuery({
    queryKey: [api.profiles.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.profiles.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return api.profiles.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useMyProfile() {
  const { getToken, isAuthenticated, isLoading } = useAuth();
  return useQuery({
    queryKey: [api.profiles.me.path],
    queryFn: async () => {
      const token = await getToken();
      if (!token) return null;
      const res = await fetch(api.profiles.me.path, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch my profile");
      return api.profiles.me.responses[200].parse(await res.json());
    },
    retry: false,
    enabled: isAuthenticated && !isLoading,
  });
}

export function useCheckUsername() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (username: string) => {
      const token = await getToken();
      const res = await fetch(api.profiles.checkUsername.path, {
        method: api.profiles.checkUsername.method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error("Failed to check username");
      return api.profiles.checkUsername.responses[200].parse(await res.json());
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<InsertProfile, "userId">) => {
      const token = await getToken();
      const res = await fetch(api.profiles.create.path, {
        method: api.profiles.create.method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create profile");
      }
      return api.profiles.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: Partial<InsertProfile>) => {
      const token = await getToken();
      const res = await fetch(api.profiles.update.path, {
        method: api.profiles.update.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return api.profiles.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.get.path, data.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/profiles/batch'] });
    },
  });
}

export function useUpdateUsername() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: { username: string }) => {
      const token = await getToken();
      const res = await fetch(api.profiles.updateUsername.path, {
        method: api.profiles.updateUsername.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update username");
      }
      return api.profiles.updateUsername.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch(api.profiles.delete.path, {
        method: api.profiles.delete.method,
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete profile");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
    },
  });
}

// --- Services ---

export function useCreateService() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: InsertService) => {
      const token = await getToken();
      // Schema defines inputs as coerced strings/numbers where appropriate
      // Just ensure we're sending what the server expects
      const res = await fetch(api.services.create.path, {
        method: api.services.create.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("A service with this name already exists");
        }
        throw new Error("Failed to create service");
      }
      return api.services.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] }); // My profile includes services
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
    },
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (id: number) => {
      const token = await getToken();
      const url = buildUrl(api.services.delete.path, { id });
      const res = await fetch(url, {
        method: api.services.delete.method,
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete service");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
    },
  });
}

// --- Reviews ---

export function useCreateReview() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (data: Omit<InsertReview, "clientId">) => {
      const token = await getToken();
      const res = await fetch(api.reviews.create.path, {
        method: api.reviews.create.method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (res.status === 409) {
        const error = await res.json();
        throw new Error(error.message || "You have already reviewed this provider");
      }
      if (!res.ok) throw new Error("Failed to submit review");
      return api.reviews.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.get.path, variables.providerId] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/check", variables.providerId] });
    },
  });
}

export function useCheckExistingReview(providerId: number | undefined) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ["/api/reviews/check", providerId],
    queryFn: async () => {
      if (!providerId) return { hasReviewed: false };
      const token = await getToken();
      const res = await fetch(`/api/reviews/check/${providerId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) return { hasReviewed: false };
      return res.json() as Promise<{ hasReviewed: boolean; reviewId?: number }>;
    },
    enabled: !!providerId,
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async ({ reviewId, providerId }: { reviewId: number; providerId: number }) => {
      const token = await getToken();
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete review");
      return providerId;
    },
    onSuccess: (providerId) => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.get.path, providerId] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/check", providerId] });
    },
  });
}
