Overview
The Adobe Data Layer (ACDL) is an event-driven, persistent data structure that tracks user interactions and page state across the entire website journey. It acts as a centralized data hub between your website and Adobe Analytics/Launch.
Core Principles
1. Data Layer Persistence Across Pages
The data layer is NOT reset on each page load
Events from previous pages are restored from sessionStorage
This creates a continuous event history throughout the user session
Adobe Launch can access any event in the history for tracking
2. Event-Driven Architecture
The data layer uses an append-only array where each user action pushes a new event:
window.adobeDataLayer = [
  {event: "cmp:loaded", component: {...}},     // Entry 0
  {event: "pageLoaded", xdmPageLoad: {...}},   // Entry 1
  {event: "linkClicked", custData: {...}},     // Entry 2
  {event: "pageLoaded", xdmPageLoad: {...}},   // Entry 3 (new page)
  // Events continue to accumulate...
]
 
Implementation Requirements
1. Page Load Events
When: On every page load (DOMContentLoaded)
What to capture:
{
  event: "pageLoaded",
  xdmPageLoad: {
    pageInfo: {
      pageName: "home page | aurora",
      pageURL: "<https://example.com/>",
      server: "aurora-server"
    },
    custData: {
      loginStatus: "guest" | "logged-in",
      platform: "desktop website" | "mobile website",
      customerID: "user123" | "",
      lang: "english" | "hindi"
    }
  }
}
 
Implementation:
Push to data layer in adl-utils.js → initAdobeDataLayer()
Restore previous page's linkClicked event from sessionStorage FIRST
Then push current page's pageLoaded event
Store in sessionStorage for persistence
2. Link Click Events
When: User clicks any navigation link, button, or CTA
What to capture:
{
  event: "linkClicked",
  custData: {
    loginStatus: "guest",
    platform: "desktop website",
    customerID: "",
    lang: "english"
  },
  xdmActionDetails: {
    web: {
      webInteraction: {
        linkName: "SELECT" | "Collection" | "Add to Cart",
        linkPageName: "home page | aurora",
        linkPosition: "hero section" | "header" | "product card",
        linkType: "navigation" | "cta" | "form",
        linkURL: "/plp.html",
        productCategory: "set-top box:new connection v3" // If applicable
      }
    }
  }
}
 
Implementation:
Use onclick="window.adl.trackLinkClick(event, {...})" on all interactive elements
Call event.preventDefault() to stop immediate navigation
Push event to data layer
Store in sessionStorage with key aurora_lastLinkClicked
Navigate programmatically after 300ms delay using setTimeout()
Elements that MUST track:
Header logo
Navigation links (Home, Collection, Cart)
Hero CTAs ("Shop Now", "Explore")
Product cards and tiles
Category selection buttons
Form submissions
Footer links
Any element that changes page or triggers action
3. SessionStorage Persistence
Purpose: Maintain event continuity across page navigations
Storage Keys:
// Store last link clicked before navigation
sessionStorage.setItem('aurora_lastLinkClicked', JSON.stringify({
  event: "linkClicked",
  custData: {...},
  xdmActionDetails: {...},
  timestamp: Date.now()
}));
// Store current page data
sessionStorage.setItem('aurora_pageData', JSON.stringify({
  event: "pageLoaded",
  xdmPageLoad: {...},
  timestamp: Date.now()
}));
 
Restoration Flow:
Page Load → Check sessionStorage → Restore linkClicked → Push pageLoaded → Update sessionStorage
 
4. Data Layer Structure
Root Level Properties:
event: String (required) - Event type identifier
custData: Object - Customer/session data (present in ALL events)
xdmPageLoad: Object - Page-specific data (only in pageLoaded events)
xdmActionDetails: Object - Interaction data (only in linkClicked events)
component: Object - Component data (optional, for component loads)
Customer Data (custData) - Required in ALL events:
{
  loginStatus: string,    // "guest" or "logged-in"
  platform: string,       // "desktop website" or "mobile website"
  customerID: string,     // User ID or empty string
  lang: string           // "english" or "hindi"
}
 
5. Console Logging for Debugging
Required logs:
// On page load
console.log('✓ ACDL: Restored linkClicked from previous page:', event);
console.log('✓ ACDL: pageLoaded tracked:', pageData);
// On link click
console.log('✓ ACDL: linkClicked tracked:', eventData);
// Data layer state
console.log('📊 ACDL Length:', window.adobeDataLayer.length);
 
6. Timing & Delays
Critical timing requirements:
Page Load: Fire immediately on DOMContentLoaded
Link Click:
Prevent default navigation
Push to data layer (synchronous)
Save to sessionStorage (synchronous)
Navigate after 300ms delay to ensure data capture
7. Adobe Launch Integration
Data Elements can access:
// Get entire data layer
adobeDataLayer
// Get specific event by filtering
adobeDataLayer.filter(e => e.event === 'linkClicked')[0]
// Get latest event
adobeDataLayer[adobeDataLayer.length - 1]
// Get state at specific path
adobeDataLayer.getState('xdmPageLoad.custData.loginStatus')
 
Rules should listen for:
event === "pageLoaded" → Fire page view beacon
event === "linkClicked" → Fire link tracking beacon
event === "cmp:loaded" → Component-specific tracking
 
Expected Behavior Example
User Journey:
User lands on home page
User clicks "Collection" in header
PLP page loads
User clicks product card
Key Differences from Traditional Implementation
Traditional	This Implementation
Data layer resets on each page	Data layer persists across pages
Only current page data available	Full event history available
No click-to-page attribution	Can track which link led to current page
Events lost on navigation	Events restored from sessionStorage
Separate tracking calls	Unified data layer approach
Testing Checklist
[ ]  Open console and check adobeDataLayer on page load
[ ]  Verify pageLoaded event is present
[ ]  Click any link and check linkClicked event is pushed
[ ]  Verify data layer length increases from 1 to 2
[ ]  After navigation, verify previous linkClicked is restored
[ ]  Verify new page's pageLoaded comes after restored linkClicked
[ ]  Check sessionStorage contains aurora_lastLinkClicked
[ ]  Verify all console logs appear with ✓ symbols
[ ]  Test on multiple pages and navigation paths
[ ]  Verify Adobe Launch rules fire correctly
