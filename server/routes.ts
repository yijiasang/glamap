import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./clerk_auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "profile-images";
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Object Storage Routes
  // registerObjectStorageRoutes(app);

  const getCurrentProfile = async (req: any) => {
    if (!req.user) return null;
    return await storage.getProfileByUserId(req.user.sub);
  }

  // Profiles
  app.get(api.profiles.list.path, async (req, res) => {
    const query = api.profiles.list.input.optional().parse(req.query);
    const profiles = await storage.listProfiles(query);
    res.json(profiles);
  });

  app.get(api.profiles.me.path, isAuthenticated, async (req, res) => {
    const profile = await getCurrentProfile(req);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    
    // Include services for the current user's profile
    const services = await storage.getServicesByProvider(profile.id);
    res.json({ ...profile, services });
  });

  app.post(api.profiles.checkUsername.path, async (req, res) => {
      const { username } = api.profiles.checkUsername.input.parse(req.body);
      const exists = await storage.getProfileByUsername(username);
      res.json({ available: !exists });
  });

  app.post(api.profiles.create.path, isAuthenticated, async (req, res) => {
      const userId = (req as any).user.sub;
      const existing = await storage.getProfileByUserId(userId);
      if (existing) return res.status(409).json({ message: "Profile already exists" });

      const input = api.profiles.create.input.parse(req.body);
      
      // Check username uniqueness
      const usernameExists = await storage.getProfileByUsername(input.username);
      if (usernameExists) return res.status(409).json({ message: "Username taken" });

      const profile = await storage.createProfile({ ...input, userId });
      res.status(201).json(profile);
  });

  app.put(api.profiles.update.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const input = api.profiles.update.input.parse(req.body);
      const updated = await storage.updateProfile(profile.id, input);
      res.json(updated);
  });

  app.delete(api.profiles.delete.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      await storage.deleteProfile(profile.id);
      res.status(204).send();
  });

  app.put(api.profiles.updateUsername.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const { username } = api.profiles.updateUsername.input.parse(req.body);
      
      // Check if username is the same (no change needed)
      if (profile.username === username) {
        return res.json(profile);
      }
      
      // Check 7-day cooldown for username changes
      if (profile.usernameChangedAt) {
        const daysSinceChange = (Date.now() - new Date(profile.usernameChangedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChange < 7) {
          const daysLeft = Math.ceil(7 - daysSinceChange);
          return res.status(429).json({ message: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` });
        }
      }
      
      // Check if username is taken
      const existing = await storage.getProfileByUsername(username);
      if (existing && existing.id !== profile.id) {
        return res.status(409).json({ message: "Username already taken" });
      }

      const updated = await storage.updateProfile(profile.id, { username, usernameChangedAt: new Date() });
      res.json(updated);
  });

  app.get(api.profiles.get.path, async (req, res) => {
    const profile = await storage.getProfile(Number(req.params.id));
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    
    const services = await storage.getServicesByProvider(profile.id);
    const reviews = await storage.getReviewsByProvider(profile.id);
    
    res.json({ ...profile, services, reviews });
  });

  // Services
  app.get(api.services.list.path, async (req, res) => {
      const { providerId } = api.services.list.input.parse(req.query);
      const services = await storage.getServicesByProvider(providerId);
      res.json(services);
  });

  app.post(api.services.create.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile || profile.role !== 'provider') return res.status(401).json({ message: "Unauthorized" });

      const input = api.services.create.input.parse(req.body);
      
      // Check if service with same name already exists for this provider
      const existingService = await storage.getServiceByNameAndProvider(input.name, profile.id);
      if (existingService) {
        return res.status(409).json({ message: "A service with this name already exists" });
      }
      
      const service = await storage.createService({ ...input, providerId: profile.id });
      res.status(201).json(service);
  });

  app.delete(api.services.delete.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      
      // Ideally check ownership
      await storage.deleteService(Number(req.params.id));
      res.status(204).send();
  });

  // Reviews
  app.get('/api/reviews/check/:providerId', isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const providerId = parseInt(req.params.providerId as string);
      const existingReview = await storage.getReviewByClientAndProvider(profile.id, providerId);
      
      res.json({ 
        hasReviewed: !!existingReview, 
        reviewId: existingReview?.id 
      });
  });

  app.post(api.reviews.create.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const input = api.reviews.create.input.parse(req.body);
      if (input.providerId === profile.id) return res.status(400).json({ message: "Cannot review yourself" });

      // Check if already reviewed
      const existingReview = await storage.getReviewByClientAndProvider(profile.id, input.providerId);
      if (existingReview) {
        return res.status(409).json({ message: "You have already reviewed this provider" });
      }

      const review = await storage.createReview({ ...input, clientId: profile.id });
      res.status(201).json(review);
  });

  app.delete('/api/reviews/:id', isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const reviewId = parseInt(req.params.id as string);
      const review = await storage.getReview(reviewId);
      
      if (!review) return res.status(404).json({ message: "Review not found" });
      if (review.clientId !== profile.id) return res.status(403).json({ message: "You can only delete your own reviews" });

      await storage.deleteReview(reviewId);
      res.status(204).send();
  });

  // Messages
  app.get(api.messages.list.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const query = api.messages.list.input.optional().parse(req.query);
      if (query?.otherUserId) {
          const msgs = await storage.getMessages(profile.id, query.otherUserId);
          res.json(msgs);
      } else {
          // List conversations
          const convos = await storage.getConversations(profile.id);
          res.json(convos);
      }
  });

  app.post(api.messages.send.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const input = api.messages.send.input.parse(req.body);
      const msg = await storage.createMessage({ ...input, senderId: profile.id });
      
      // Create notification for the receiver
      await storage.createNotification({
        profileId: input.receiverId,
        type: 'message',
        title: 'New Message',
        content: `${profile.username} sent you a message`,
        link: '/messages',
      });
      
      res.status(201).json(msg);
  });

  app.delete(api.messages.delete.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const messageId = Number(req.params.id);
      const message = await storage.getMessage(messageId);
      
      // Only allow deletion if user is sender or receiver
      if (!message || (message.senderId !== profile.id && message.receiverId !== profile.id)) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteMessage(messageId);
      res.status(204).send();
  });

  app.delete(api.messages.deleteConversation.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const otherUserId = Number(req.params.otherUserId);
      await storage.deleteConversation(profile.id, otherUserId);
      res.status(204).send();
  });

  // Notifications
  app.get(api.notifications.list.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      
      const notifs = await storage.getNotifications(profile.id);
      res.json(notifs);
  });

  app.delete(api.notifications.delete.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      
      const notificationId = Number(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification || notification.profileId !== profile.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      await storage.deleteNotification(notificationId);
      res.status(204).send();
  });

  app.delete(api.notifications.clear.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      
      await storage.clearAllNotifications(profile.id);
      res.status(204).send();
  });

  app.put(api.notifications.markRead.path, isAuthenticated, async (req, res) => {
      const profile = await getCurrentProfile(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      
      const notificationId = Number(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification || notification.profileId !== profile.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      await storage.markNotificationRead(notificationId);
      res.status(204).send();
  });

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const profile = await storage.getProfileByUserId(req.user.sub);
    if (!profile || !profile.isAdmin) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  };

  // Admin Routes
  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  app.get("/api/admin/profiles", isAuthenticated, isAdmin, async (req, res) => {
    const allProfiles = await storage.getAllProfiles();
    res.json(allProfiles);
  });

  app.delete("/api/admin/profiles/:id", isAuthenticated, isAdmin, async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid profile ID" });
    
    const profile = await storage.getProfile(id);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    
    // Prevent deleting the admin account
    if (profile.isAdmin) {
      return res.status(400).json({ message: "Cannot delete admin account" });
    }
    
    await storage.adminDeleteProfile(id);
    res.status(204).send();
  });

  // Upload endpoint for profile images
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      // Generate a unique filename
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Determine file extension from content type or name
      let extension = 'jpg'; // default
      if (contentType) {
        if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
        else if (contentType.includes('png')) extension = 'png';
        else if (contentType.includes('gif')) extension = 'gif';
        else if (contentType.includes('webp')) extension = 'webp';
      } else if (name) {
        const nameExt = name.split('.').pop();
        if (nameExt) extension = nameExt;
      }

      const filename = `${fileId}.${extension}`;
      const objectPath = `/profiles/${filename}`;

      if (supabase) {
        const storagePath = `profiles/${filename}`;
        const { data, error } = await supabase.storage
          .from(supabaseBucket)
          .createSignedUploadUrl(storagePath);

        if (error || !data?.signedUrl) {
          console.error("Supabase upload URL error:", error);
          return res.status(500).json({ error: "Failed to generate upload URL" });
        }

        const publicUrl = supabase.storage
          .from(supabaseBucket)
          .getPublicUrl(storagePath).data.publicUrl;

        return res.json({
          uploadURL: data.signedUrl,
          objectPath: publicUrl,
          metadata: {
            name: name || `upload.${extension}`,
            size,
            contentType: contentType || "image/jpeg",
          },
        });
      }

      // Return a local upload URL for development
      const proto = (req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
      const uploadURL = `${proto}://${req.get('host')}/api/uploads/upload/${filename}`;

      res.json({
        uploadURL,
        objectPath,
        metadata: {
          name: name || `upload.${extension}`,
          size,
          contentType: contentType || 'image/jpeg'
        }
      });
    } catch (error) {
      console.error('Upload request error:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  });

  // Handle direct file uploads (for development)
  // Note: In production with real presigned URLs, this wouldn't need authentication
  app.put("/api/uploads/upload/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const fs = await import('fs');
      const path = await import('path');

      // Ensure profiles directory exists
      const profilesDir = path.resolve('public/profiles');
      await fs.promises.mkdir(profilesDir, { recursive: true });

      const filePath = path.join(profilesDir, filename);

      // req.body is now raw buffer from the express.raw middleware
      await fs.promises.writeFile(filePath, req.body);

      res.status(200).send();
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });

  app.get("/api/admin/page-visits", isAuthenticated, isAdmin, async (req, res) => {
    const count = await storage.getPageVisitCount();
    res.json({ count });
  });

  return httpServer;
}
