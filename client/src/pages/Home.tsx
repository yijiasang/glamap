import { useState, useRef, useCallback, useMemo } from "react";
import { useProfiles } from "@/hooks/use-profiles";
import { Navigation } from "@/components/Navigation";
import Map from "@/components/Map";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Star, Loader2, GripVertical, User, SlidersHorizontal, Home, Building2, Palette, Store, Car, ArrowUpDown, TrendingUp, MessageSquareText, Hash } from "lucide-react";
import { searchLocations } from "@/data/australian-locations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

const CATEGORIES = [
  "All",
  "Makeup",
  "Nails",
  "Hair",
  "Lashes",
  "Brows",
  "Skincare"
];

const LOCATION_TYPES = [
  { value: "house", label: "House", icon: Home },
  { value: "apartment", label: "Apartment", icon: Building2 },
  { value: "studio", label: "Studio", icon: Palette },
  { value: "rented_space", label: "Rented Space", icon: Store },
  { value: "mobile", label: "Mobile", icon: Car },
];

const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "rating_high", label: "Highest Rated" },
  { value: "rating_low", label: "Lowest Rated" },
  { value: "reviews_high", label: "Most Reviews" },
  { value: "reviews_low", label: "Least Reviews" },
];

export default function HomePage() {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocationTypes, setSelectedLocationTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("default");
  const [directoryWidth, setDirectoryWidth] = useState(450);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [hoveredProfileId, setHoveredProfileId] = useState<number | null>(null);
  const isResizing = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const toggleCategory = (cat: string) => {
    if (cat === "All") {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(prev => 
        prev.includes(cat) 
          ? prev.filter(c => c !== cat) 
          : [...prev, cat]
      );
    }
  };
  
  const toggleLocationType = (type: string) => {
    setSelectedLocationTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };
  
  // In a real app, we would get this from navigator.geolocation
  const [userLocation] = useState<[number, number]>([-33.8688, 151.2093]); // Sydney, Australia
  
  // Handle mouse drag to resize directory
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 280), 700);
      setDirectoryWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const { data: profiles, isLoading } = useProfiles({ 
    search: searchTerm,
    services: selectedCategories.length > 0 ? selectedCategories : undefined,
    locationTypes: selectedLocationTypes.length > 0 ? selectedLocationTypes : undefined
  });
  
  // Get all profiles for suggestions
  const { data: allProfiles } = useProfiles({});
  
  // Compute search suggestions from all profiles AND comprehensive location database
  const suggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];
    
    const term = searchTerm.toLowerCase();
    const results: { type: 'user' | 'location' | 'postcode'; value: string; display: string }[] = [];
    const seenValues = new Set<string>();
    
    // First, add matching usernames from providers
    allProfiles?.forEach(profile => {
      if (profile.username?.toLowerCase().includes(term)) {
        const key = `user-${profile.username.toLowerCase()}`;
        if (!seenValues.has(key)) {
          seenValues.add(key);
          results.push({ 
            type: 'user', 
            value: profile.username, 
            display: profile.username 
          });
        }
      }
    });
    
    // Then add locations from comprehensive database (suburbs only)
    const locationResults = searchLocations(searchTerm, 10);
    locationResults.forEach(loc => {
      // Add as location (suburb)
      const locationKey = `location-${loc.suburb.toLowerCase()}`;
      if (!seenValues.has(locationKey)) {
        seenValues.add(locationKey);
        results.push({ 
          type: 'location', 
          value: loc.suburb, 
          display: loc.display
        });
      }
    });
    
    return results.slice(0, 8); // Limit to 8 suggestions
  }, [allProfiles, searchTerm]);
  
  // Sort profiles based on selected sort option
  const sortedProfiles = useMemo(() => {
    if (!profiles) return [];
    
    const sorted = [...profiles];
    switch (sortBy) {
      case "rating_high":
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case "rating_low":
        return sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0));
      case "reviews_high":
        return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      case "reviews_low":
        return sorted.sort((a, b) => (a.reviewCount || 0) - (b.reviewCount || 0));
      default:
        return sorted;
    }
  }, [profiles, sortBy]);
  
  const handleSelectSuggestion = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-background">
      <Navigation />
      
      <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Sidebar - List View */}
        <div 
          className={`flex flex-col min-h-0 border-r border-border bg-card/50 backdrop-blur-sm z-10 shadow-2xl relative ${mobileView === 'map' ? 'hidden md:flex' : 'flex'} md:flex`}
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? directoryWidth : '100%' }}
        >
          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="hidden md:flex absolute right-0 top-0 bottom-0 w-2 cursor-col-resize items-center justify-center hover:bg-primary/20 transition-colors z-20 group"
            data-testid="resize-handle"
          >
            <div className="w-1 h-12 bg-border rounded-full group-hover:bg-primary/50 transition-colors" />
          </div>
          
          {/* Search Header */}
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 border-b border-border bg-background/95 sticky top-0 z-[9999]">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Find Beauty <span className="text-primary">Near You</span>
            </h1>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
                <Input 
                  ref={searchInputRef}
                  placeholder="Search stylists, suburbs, or postcodes..." 
                  className="pl-10 h-12 rounded-xl bg-secondary/50 border-transparent focus:bg-background transition-all"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  data-testid="input-search"
                />
                
                {/* Search Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-[9999] overflow-hidden">
                    <div className="max-h-[156px] overflow-y-auto">
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={`${suggestion.type}-${suggestion.value}-${idx}`}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(suggestion.value);
                          }}
                          data-testid={`suggestion-${suggestion.type}-${idx}`}
                        >
                          {suggestion.type === 'user' ? (
                            <User className="w-4 h-4 text-primary" />
                          ) : suggestion.type === 'postcode' ? (
                            <Hash className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{suggestion.display}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {suggestion.type === 'user' ? 'Stylist' : suggestion.type === 'postcode' ? 'Postcode' : 'Location'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Filter Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={`h-12 w-12 rounded-xl shrink-0 ${selectedLocationTypes.length > 0 ? 'border-primary bg-primary/10' : ''}`}
                    data-testid="button-filter"
                  >
                    <SlidersHorizontal size={18} />
                    {selectedLocationTypes.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold rounded-full">
                        {selectedLocationTypes.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Location Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {LOCATION_TYPES.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuCheckboxItem
                      key={value}
                      checked={selectedLocationTypes.includes(value)}
                      onCheckedChange={() => toggleLocationType(value)}
                      data-testid={`filter-location-${value}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Sort Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={`h-12 w-12 rounded-xl shrink-0 ${sortBy !== 'default' ? 'border-primary bg-primary/10' : ''}`}
                    data-testid="button-sort"
                  >
                    <ArrowUpDown size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                    {SORT_OPTIONS.map(({ value, label }) => (
                      <DropdownMenuRadioItem 
                        key={value} 
                        value={value}
                        data-testid={`sort-${value}`}
                      >
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 sm:-mx-6 px-4 sm:px-6">
              {CATEGORIES.map((cat) => {
                const isSelected = cat === "All" 
                  ? selectedCategories.length === 0 
                  : selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    data-testid={`filter-${cat.toLowerCase()}`}
                    className={`
                      whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all
                      ${isSelected 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105' 
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}
                    `}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6 space-y-4 sm:space-y-6 pb-24 md:pb-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                <p>Finding beauty pros...</p>
              </div>
            ) : sortedProfiles.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p>No providers found in this area.</p>
                <Button variant="ghost" onClick={() => {setSearchTerm(""); setSelectedCategories([]); setSelectedLocationTypes([]); setSortBy("default");}}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <AnimatePresence>
                  {sortedProfiles.map((profile, idx) => (
                    <motion.div
                      key={profile.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Link href={`/profile/${profile.username}`}>
                        <div 
                          className="group cursor-pointer bg-card hover:bg-card/80 border border-border/50 hover:border-primary/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all hover:shadow-lg hover:-translate-y-1"
                          onMouseEnter={() => setHoveredProfileId(profile.id)}
                          onMouseLeave={() => setHoveredProfileId(null)}
                        >
                          <div className="flex gap-3 sm:gap-4">
                            {/* Avatar */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl bg-muted shrink-0 overflow-hidden relative">
                              {profile.profileImageUrl ? (
                                <img 
                                  src={profile.profileImageUrl} 
                                  alt={profile.username} 
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-2xl font-display font-bold text-muted-foreground bg-secondary">
                                  {profile.username[0].toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-display font-bold text-lg truncate pr-2 group-hover:text-primary transition-colors">
                                    {profile.username}
                                  </h3>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <MapPin size={12} /> 
                                    {profile.locationType ? profile.locationType.replace('_', ' ') : 'Mobile'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold border border-amber-100">
                                  <Star size={10} className="fill-current" />
                                  {profile.rating?.toFixed(1) || "New"}
                                </div>
                              </div>
                              
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                {profile.bio || "No bio yet."}
                              </p>
                              
                              <div className="flex flex-wrap gap-2 mt-3">
                                {profile.services.slice(0, 3).map(s => (
                                  <span key={s.id} className="text-xs bg-secondary/50 px-2 py-1 rounded-md text-secondary-foreground font-medium">
                                    {s.name}{s.price ? ` • $${s.price}` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Right - Map View */}
        <div className={`flex-1 relative bg-secondary/20 ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          {(!isMobile || mobileView === 'map') && (
            <Map 
              profiles={profiles || []} 
              center={userLocation}
              hoveredProfileId={hoveredProfileId}
              isVisible={!isMobile || mobileView === 'map'}
            />
          )}
        </div>
        
        {/* Mobile View Toggle */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden z-50">
          <Button 
            onClick={() => setMobileView(mobileView === 'list' ? 'map' : 'list')}
            className="rounded-full shadow-xl bg-foreground text-background font-bold px-6 py-3 h-auto"
            data-testid="button-mobile-view-toggle"
          >
            {mobileView === 'list' ? (
              <><MapPin size={18} className="mr-2" /> View Map</>
            ) : (
              <><Search size={18} className="mr-2" /> View List</>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
