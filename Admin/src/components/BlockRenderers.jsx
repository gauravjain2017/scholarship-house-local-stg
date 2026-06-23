import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dealsAPI } from '../api/deals';

/* ═══════════════════════════════════════════════════
   Responsive hook — returns { w, mobile, tablet, desktop }
   mobile: <=640   tablet: 641-1024   desktop: >1024
   ═══════════════════════════════════════════════════ */
function useResponsive() {
  const getSize = () => (typeof window !== "undefined" ? window.innerWidth : 1200);
  const [w, setW] = useState(getSize);
  useEffect(() => {
    let raf;
    const handler = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(getSize())); };
    window.addEventListener("resize", handler);
    return () => { window.removeEventListener("resize", handler); cancelAnimationFrame(raf); };
  }, []);
  return { w, mobile: w <= 640, tablet: w > 640 && w <= 1024, desktop: w > 1024 };
}

/* ═══════════════════════════════════════════════════
   Widget Registry — each widget defines its type,
   default data, content fields, and per-widget
   typography defaults.
   ═══════════════════════════════════════════════════ */

export const HEADING_TAGS = ["h1","h2","h3","h4","h5","h6","p","span","div"];

export const FONT_FAMILIES = [
  { value: "'DM Serif Display', Georgia, serif", label: "DM Serif Display" },
  { value: "'Inter', system-ui, sans-serif", label: "Inter" },
  { value: "'Poppins', sans-serif", label: "Poppins" },
  { value: "'Roboto', sans-serif", label: "Roboto" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Fira Code', monospace", label: "Fira Code (mono)" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "system-ui, sans-serif", label: "System Default" },
];

export const FONT_WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
];

export const TEXT_TRANSFORMS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
  { value: "capitalize", label: "Capitalize" },
];

export const TEXT_ALIGNS = [
  { value: "left", label: "Left", icon: "align-left" },
  { value: "center", label: "Center", icon: "align-center" },
  { value: "right", label: "Right", icon: "align-right" },
  { value: "justify", label: "Justify", icon: "align-justify" },
];

export const WIDGET_REGISTRY = [
  {
    type: "hero",
    label: "Hero Banner",
    icon: "\u{1F3E0}",
    accentColor: "#1e1b4b",
    description: "Big headline with subtitle and CTA button",
    defaultData: {
      title: "Welcome back, Alex \u{1F44B}",
      titleTag: "h2",
      subtitle: "Here's everything happening in your workspace today.",
      ctaLabel: "View Reports",
      ctaColor: "#4f46e5",
      bgGradientFrom: "#1e1b4b",
      bgGradientTo: "#312e81",
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "titleTag", label: "HTML Tag", type: "headingTag" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "ctaLabel", label: "Button Text", type: "text" },
      { key: "ctaColor", label: "Button Color", type: "color" },
      { key: "bgGradientFrom", label: "Gradient From", type: "color" },
      { key: "bgGradientTo", label: "Gradient To", type: "color" },
    ],
  },
  {
    type: "stats",
    label: "Stats Row",
    icon: "\u{1F4CA}",
    accentColor: "#064e3b",
    description: "Three key metric cards side by side",
    defaultData: {
      stat1Value: "2,430", stat1Label: "Total Users",
      stat2Value: "$18.2k", stat2Label: "Monthly Revenue",
      stat3Value: "94%", stat3Label: "Uptime",
      valueTag: "div",
    },
    fields: [
      { key: "stat1Value", label: "Stat 1 Value", type: "text" },
      { key: "stat1Label", label: "Stat 1 Label", type: "text" },
      { key: "stat2Value", label: "Stat 2 Value", type: "text" },
      { key: "stat2Label", label: "Stat 2 Label", type: "text" },
      { key: "stat3Value", label: "Stat 3 Value", type: "text" },
      { key: "stat3Label", label: "Stat 3 Label", type: "text" },
      { key: "valueTag", label: "Value HTML Tag", type: "headingTag" },
    ],
  },
  {
    type: "chart",
    label: "Bar Chart",
    icon: "\u{1F4C8}",
    accentColor: "#1e3a5f",
    description: "Monthly bar chart overview",
    defaultData: { title: "Monthly Revenue Overview", titleTag: "p", color: "#4f46e5" },
    fields: [
      { key: "title", label: "Chart Title", type: "text" },
      { key: "titleTag", label: "Title HTML Tag", type: "headingTag" },
      { key: "color", label: "Bar Color", type: "color" },
    ],
  },
  {
    type: "table",
    label: "Recent Activity",
    icon: "\u{1F4CB}",
    accentColor: "#1a3d1f",
    description: "Latest records in a clean table",
    defaultData: { title: "Recent Orders", titleTag: "p" },
    fields: [
      { key: "title", label: "Table Title", type: "text" },
      { key: "titleTag", label: "Title HTML Tag", type: "headingTag" },
    ],
  },
  {
    type: "cards",
    label: "Feature Cards",
    icon: "\u{1F5C2}\uFE0F",
    accentColor: "#451a03",
    description: "2-column card grid with titles and descriptions",
    defaultData: {
      card1Title: "Analytics", card1Desc: "Track key metrics across your platform in real time.",
      card2Title: "Integrations", card2Desc: "Connect your favourite tools with one click.",
      card3Title: "Automation", card3Desc: "Set up workflows to save hours every week.",
      card4Title: "Security", card4Desc: "Enterprise-grade protection for your data.",
      columns: "2",
    },
    fields: [
      { key: "columns", label: "Columns", type: "select", options: [
        { value: "1", label: "1 Column" }, { value: "2", label: "2 Columns" },
        { value: "3", label: "3 Columns" }, { value: "4", label: "4 Columns" },
      ]},
      { key: "card1Title", label: "Card 1 Title", type: "text" },
      { key: "card1Desc", label: "Card 1 Description", type: "textarea" },
      { key: "card2Title", label: "Card 2 Title", type: "text" },
      { key: "card2Desc", label: "Card 2 Description", type: "textarea" },
      { key: "card3Title", label: "Card 3 Title", type: "text" },
      { key: "card3Desc", label: "Card 3 Description", type: "textarea" },
      { key: "card4Title", label: "Card 4 Title", type: "text" },
      { key: "card4Desc", label: "Card 4 Description", type: "textarea" },
    ],
  },
  {
    type: "notice",
    label: "Announcement",
    icon: "\u{1F4E2}",
    accentColor: "#1e3a5f",
    description: "Info or alert banner for announcements",
    defaultData: {
      message: "\u{1F389} New feature: Bulk export is now available. Check the docs for details.",
      variant: "info",
    },
    fields: [
      { key: "message", label: "Message", type: "textarea" },
      { key: "variant", label: "Variant", type: "select", options: [
        { value: "info", label: "Info" }, { value: "warning", label: "Warning" },
        { value: "success", label: "Success" },
      ]},
    ],
  },
  {
    type: "text",
    label: "Text Block",
    icon: "\u{1F4DD}",
    accentColor: "#3b0764",
    description: "Heading with a paragraph of body text",
    defaultData: {
      heading: "About this dashboard",
      headingTag: "h3",
      headingColor: "#1e293b",
      headingSize: "16",
      body: "This homepage gives you a quick overview of your account activity, performance metrics, and recent events all in one place. Use the admin panel to customise what appears here.",
      bodyColor: "#64748b",
      bodySize: "13",
      textAlign: "left",
    },
    fields: [
      { key: "heading", label: "Heading Text", type: "text" },
      { key: "headingTag", label: "Heading HTML Tag", type: "headingTag" },
      { key: "headingColor", label: "Heading Color", type: "color" },
      { key: "headingSize", label: "Heading Font Size (px)", type: "number" },
      { key: "body", label: "Body Text", type: "textarea" },
      { key: "bodyColor", label: "Body Color", type: "color" },
      { key: "bodySize", label: "Body Font Size (px)", type: "number" },
      { key: "textAlign", label: "Text Align", type: "textAlign" },
    ],
  },
  {
    type: "imageBanner",
    label: "Image Banner",
    icon: "\u{1F5BC}\uFE0F",
    accentColor: "#7c2d12",
    description: "Full-width banner with image, overlay text and CTA",
    defaultData: {
      image: "",
      title: "Discover What's New",
      titleTag: "h2",
      subtitle: "Explore our latest features and updates built just for you.",
      ctaLabel: "Learn More",
      ctaColor: "#4f46e5",
      overlayOpacity: "0.5",
      minHeight: "160",
    },
    fields: [
      { key: "image", label: "Image URL", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "titleTag", label: "Title HTML Tag", type: "headingTag" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "ctaLabel", label: "Button Text", type: "text" },
      { key: "ctaColor", label: "Button Color", type: "color" },
      { key: "overlayOpacity", label: "Overlay Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "minHeight", label: "Min Height (px)", type: "number" },
    ],
  },
  {
    type: "grid",
    label: "Grid",
    icon: "\u{1F4D0}",
    accentColor: "#0e7490",
    description: "Grid layout with text & image cells",
    defaultData: {
      rows: "1",
      columns: "2",
      gap: "10",
      cellMinHeight: "120",
      cellFontSize: "12",
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [
          [`cell${n}Image`, ""], [`cell${n}ImageHeight`, ""],
          [`cell${n}Heading`, ""], [`cell${n}HeadingTag`, "h3"],
          [`cell${n}Text`, `Cell ${n} text`],
          [`cell${n}BtnLabel`, ""], [`cell${n}BtnUrl`, ""],
          [`cell${n}BtnBgColor`, "#4f46e5"], [`cell${n}BtnTextColor`, "#ffffff"],
          [`cell${n}BgColor`, "#f8fafc"], [`cell${n}BorderColor`, "#e2e8f0"],
          [`cell${n}BorderRadius`, "10"],
          [`cell${n}PaddingTop`, "12"], [`cell${n}PaddingBottom`, "12"],
          [`cell${n}PaddingLeft`, "12"], [`cell${n}PaddingRight`, "12"],
          [`cell${n}MarginTop`, "0"], [`cell${n}MarginBottom`, "0"],
          [`cell${n}MarginLeft`, "0"], [`cell${n}MarginRight`, "0"],
        ])
      ),
    },
    // Fields are generated dynamically based on rows * columns
    fields: [
      { key: "rows", label: "Rows", type: "number" },
      { key: "columns", label: "Columns", type: "number" },
      { key: "gap", label: "Gap (px)", type: "number" },
      { key: "cellMinHeight", label: "Cell Min Height (px)", type: "number" },
      { key: "cellFontSize", label: "Cell Font Size (px)", type: "number" },
      ...Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) => [
        { key: `cell${n}Image`, label: `Cell ${n} Image`, type: "imageUpload", cellIndex: n },
        { key: `cell${n}ImageHeight`, label: `Cell ${n} Image Height (px)`, type: "number", cellIndex: n },
        { key: `cell${n}Heading`, label: `Cell ${n} Heading`, type: "text", cellIndex: n },
        { key: `cell${n}HeadingTag`, label: `Cell ${n} Heading Tag`, type: "headingTag", cellIndex: n },
        { key: `cell${n}Text`, label: `Cell ${n} Text`, type: "textarea", cellIndex: n },
        { key: `cell${n}BtnLabel`, label: `Cell ${n} Button Text`, type: "text", cellIndex: n },
        { key: `cell${n}BtnUrl`, label: `Cell ${n} Button Link`, type: "text", cellIndex: n },
        { key: `cell${n}BtnBgColor`, label: `Cell ${n} Button Background`, type: "color", cellIndex: n },
        { key: `cell${n}BtnTextColor`, label: `Cell ${n} Button Text Color`, type: "color", cellIndex: n },
        { key: `cell${n}BgColor`, label: `Cell ${n} Background`, type: "color", cellIndex: n },
        { key: `cell${n}BorderColor`, label: `Cell ${n} Border Color`, type: "color", cellIndex: n },
        { key: `cell${n}BorderRadius`, label: `Cell ${n} Border Radius (px)`, type: "number", cellIndex: n },
        { key: `cell${n}Padding`, label: `Cell ${n} Padding`, type: "spacing4", cellIndex: n,
          keys: { top: `cell${n}PaddingTop`, bottom: `cell${n}PaddingBottom`, left: `cell${n}PaddingLeft`, right: `cell${n}PaddingRight` } },
        { key: `cell${n}Margin`, label: `Cell ${n} Margin`, type: "spacing4", cellIndex: n,
          keys: { top: `cell${n}MarginTop`, bottom: `cell${n}MarginBottom`, left: `cell${n}MarginLeft`, right: `cell${n}MarginRight` } },
      ]),
    ],
  },
  {
    type: "imageSlider",
    label: "Image Slider",
    icon: "\u{1F3A0}",
    accentColor: "#7c3aed",
    description: "Full-screen image carousel with autoplay & overlay text",
    defaultData: {
      slide1Image: "", slide1Title: "Welcome to Our Platform", slide1Subtitle: "Discover amazing deals and opportunities", slide1CtaLabel: "Get Started", slide1CtaUrl: "#",
      slide2Image: "", slide2Title: "Browse Properties", slide2Subtitle: "Find your dream home today", slide2CtaLabel: "Browse Now", slide2CtaUrl: "#",
      slide3Image: "", slide3Title: "Expert Support", slide3Subtitle: "We're here to help you every step of the way", slide3CtaLabel: "Contact Us", slide3CtaUrl: "#",
      slide4Image: "", slide4Title: "", slide4Subtitle: "", slide4CtaLabel: "", slide4CtaUrl: "#",
      slide5Image: "", slide5Title: "", slide5Subtitle: "", slide5CtaLabel: "", slide5CtaUrl: "#",
      slideCount: "3",
      minHeight: "500",
      autoPlay: "true",
      autoPlaySpeed: "5",
      overlayOpacity: "0.4",
      ctaColor: "#4f46e5",
      titleTag: "h1",
      showDots: "true",
      showArrows: "true",
      transitionSpeed: "0.6",
    },
    fields: [
      { key: "slideCount", label: "Number of Slides", type: "select", options: [
        { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" },
        { value: "4", label: "4" }, { value: "5", label: "5" },
      ]},
      { key: "minHeight", label: "Slider Height (px)", type: "number" },
      { key: "autoPlay", label: "Auto Play", type: "select", options: [
        { value: "true", label: "Yes" }, { value: "false", label: "No" },
      ]},
      { key: "autoPlaySpeed", label: "Auto Play Speed (seconds)", type: "number" },
      { key: "transitionSpeed", label: "Transition Speed (seconds)", type: "number" },
      { key: "overlayOpacity", label: "Overlay Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "ctaColor", label: "Button Color", type: "color" },
      { key: "titleTag", label: "Title HTML Tag", type: "headingTag" },
      { key: "showDots", label: "Show Dots", type: "select", options: [
        { value: "true", label: "Yes" }, { value: "false", label: "No" },
      ]},
      { key: "showArrows", label: "Show Arrows", type: "select", options: [
        { value: "true", label: "Yes" }, { value: "false", label: "No" },
      ]},
      { key: "slide1Image", label: "Slide 1 Image URL", type: "text" },
      { key: "slide1Title", label: "Slide 1 Title", type: "text" },
      { key: "slide1Subtitle", label: "Slide 1 Subtitle", type: "textarea" },
      { key: "slide1CtaLabel", label: "Slide 1 Button Text", type: "text" },
      { key: "slide1CtaUrl", label: "Slide 1 Button Link", type: "text" },
      { key: "slide2Image", label: "Slide 2 Image URL", type: "text" },
      { key: "slide2Title", label: "Slide 2 Title", type: "text" },
      { key: "slide2Subtitle", label: "Slide 2 Subtitle", type: "textarea" },
      { key: "slide2CtaLabel", label: "Slide 2 Button Text", type: "text" },
      { key: "slide2CtaUrl", label: "Slide 2 Button Link", type: "text" },
      { key: "slide3Image", label: "Slide 3 Image URL", type: "text" },
      { key: "slide3Title", label: "Slide 3 Title", type: "text" },
      { key: "slide3Subtitle", label: "Slide 3 Subtitle", type: "textarea" },
      { key: "slide3CtaLabel", label: "Slide 3 Button Text", type: "text" },
      { key: "slide3CtaUrl", label: "Slide 3 Button Link", type: "text" },
      { key: "slide4Image", label: "Slide 4 Image URL", type: "text" },
      { key: "slide4Title", label: "Slide 4 Title", type: "text" },
      { key: "slide4Subtitle", label: "Slide 4 Subtitle", type: "textarea" },
      { key: "slide4CtaLabel", label: "Slide 4 Button Text", type: "text" },
      { key: "slide4CtaUrl", label: "Slide 4 Button Link", type: "text" },
      { key: "slide5Image", label: "Slide 5 Image URL", type: "text" },
      { key: "slide5Title", label: "Slide 5 Title", type: "text" },
      { key: "slide5Subtitle", label: "Slide 5 Subtitle", type: "textarea" },
      { key: "slide5CtaLabel", label: "Slide 5 Button Text", type: "text" },
      { key: "slide5CtaUrl", label: "Slide 5 Button Link", type: "text" },
    ],
  },
  {
    type: "propertiesSlider",
    label: "Properties Slider",
    icon: "\u{1F3E0}",
    accentColor: "#dc2626",
    description: "Horizontal slider of trending properties",
    defaultData: {
      sectionTitle: "Trending",
      sectionSubtitle: "PROPERTIES",
      badgeText: "OFFERS",
      badgeColor: "#dc2626",
      ctaLabel: "ENQUIRE NOW",
      ctaColor: "#dc2626",
      maxProperties: "10",
      autoScroll: "true",
      scrollSpeed: "3",
      selectedProperties: "[]",
    },
    fields: [
      { key: "sectionTitle", label: "Section Title", type: "text" },
      { key: "sectionSubtitle", label: "Section Subtitle", type: "text" },
      { key: "selectedProperties", label: "Select Properties", type: "propertySelector" },
      { key: "badgeText", label: "Badge Text", type: "text" },
      { key: "badgeColor", label: "Badge / CTA Color", type: "color" },
      { key: "ctaLabel", label: "CTA Button Text", type: "text" },
      { key: "maxProperties", label: "Max Properties", type: "number" },
      { key: "autoScroll", label: "Auto Scroll", type: "select", options: [
        { value: "true", label: "Yes" }, { value: "false", label: "No" },
      ]},
      { key: "scrollSpeed", label: "Scroll Speed (seconds)", type: "number" },
    ],
  },
  {
    type: "paragraph",
    label: "Paragraph",
    icon: "\u{270F}\uFE0F",
    accentColor: "#4338ca",
    description: "Rich text paragraph with image & button",
    defaultData: {
      content: "<p>Start writing your paragraph here...</p>",
      textAlign: "left",
      bodyColor: "#374151",
      bodySize: "14",
      // Image
      image: "",
      imagePosition: "top",
      imageMaxWidth: "100",
      imageBorderRadius: "8",
      // Button
      showButton: "no",
      btnLabel: "Learn More",
      btnUrl: "",
      btnBgColor: "#4f46e5",
      btnTextColor: "#ffffff",
      btnSize: "medium",
      btnBorderRadius: "8",
    },
    fields: [
      { key: "content", label: "Paragraph Content", type: "richtext" },
      { key: "bodyColor", label: "Text Color", type: "color" },
      { key: "bodySize", label: "Font Size (px)", type: "number" },
      { key: "textAlign", label: "Text Align", type: "textAlign" },
      { key: "image", label: "Image", type: "imageUpload" },
      { key: "imagePosition", label: "Image Position", type: "select", options: [
        { value: "top", label: "Above Text" }, { value: "bottom", label: "Below Text" },
        { value: "left", label: "Left of Text" }, { value: "right", label: "Right of Text" },
      ]},
      { key: "imageMaxWidth", label: "Image Max Width (%)", type: "number" },
      { key: "imageBorderRadius", label: "Image Border Radius (px)", type: "number" },
      { key: "showButton", label: "Show Button", type: "select", options: [
        { value: "yes", label: "Yes" }, { value: "no", label: "No" },
      ]},
      { key: "btnLabel", label: "Button Text", type: "text" },
      { key: "btnUrl", label: "Button Link", type: "text" },
      { key: "btnBgColor", label: "Button Background", type: "color" },
      { key: "btnTextColor", label: "Button Text Color", type: "color" },
      { key: "btnSize", label: "Button Size", type: "select", options: [
        { value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" },
      ]},
      { key: "btnBorderRadius", label: "Button Radius (px)", type: "number" },
    ],
  },
  {
    type: "imageSection",
    label: "Image Section",
    icon: "\u{1F5BC}\uFE0F",
    accentColor: "#0369a1",
    description: "Image with overlay text & button",
    defaultData: {
      image: "",
      overlayOpacity: "0.45",
      minHeight: "280",
      // Text
      title: "Your Heading Here",
      titleTag: "h2",
      titleSize: "28",
      titleColor: "#ffffff",
      subtitle: "Add a short description or tagline here.",
      subtitleSize: "14",
      subtitleColor: "rgba(255,255,255,0.8)",
      textAlign: "center",
      // Button
      showButton: "yes",
      btnLabel: "Explore Now",
      btnUrl: "",
      btnBgColor: "#4f46e5",
      btnTextColor: "#ffffff",
      btnSize: "medium",
      btnBorderRadius: "8",
    },
    fields: [
      { key: "image", label: "Background Image", type: "imageUpload" },
      { key: "overlayOpacity", label: "Overlay Darkness", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "minHeight", label: "Min Height (px)", type: "number" },
      { key: "title", label: "Heading Text", type: "text" },
      { key: "titleTag", label: "Heading Tag", type: "headingTag" },
      { key: "titleSize", label: "Heading Font Size (px)", type: "number" },
      { key: "titleColor", label: "Heading Color", type: "color" },
      { key: "subtitle", label: "Subtitle Text", type: "textarea" },
      { key: "subtitleSize", label: "Subtitle Font Size (px)", type: "number" },
      { key: "subtitleColor", label: "Subtitle Color", type: "color" },
      { key: "textAlign", label: "Text Alignment", type: "textAlign" },
      { key: "showButton", label: "Show Button", type: "select", options: [
        { value: "yes", label: "Yes" }, { value: "no", label: "No" },
      ]},
      { key: "btnLabel", label: "Button Text", type: "text" },
      { key: "btnUrl", label: "Button Link", type: "text" },
      { key: "btnBgColor", label: "Button Background", type: "color" },
      { key: "btnTextColor", label: "Button Text Color", type: "color" },
      { key: "btnSize", label: "Button Size", type: "select", options: [
        { value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" },
      ]},
      { key: "btnBorderRadius", label: "Button Radius (px)", type: "number" },
    ],
  },
];

/* ═══════════════════════════════════════════════════
   Default block style & style field definitions
   ═══════════════════════════════════════════════════ */

export const DEFAULT_BLOCK_STYLE = {
  // Spacing
  paddingTop: "16", paddingBottom: "16", paddingLeft: "16", paddingRight: "16",
  marginTop: "0", marginBottom: "0",
  // Background
  backgroundColor: "",
  bgGradient: "",           // e.g. "linear-gradient(135deg, #1e1b4b, #312e81)"
  // Border
  borderRadius: "12",
  borderWidth: "0",
  borderColor: "#e2e8f0",
  borderStyle: "solid",
  // Shadow
  boxShadow: "",
  // Size
  minHeight: "",
  maxWidth: "",
  overflow: "visible",
  // Typography (block-level)
  fontFamily: "",
  fontSize: "",
  fontWeight: "",
  lineHeight: "",
  letterSpacing: "",
  textColor: "",
  textAlign: "",
  textTransform: "",
  // Opacity
  opacity: "1",
};

export const STYLE_FIELDS = [
  {
    group: "Typography",
    icon: "type",
    fields: [
      { key: "fontFamily", label: "Font Family", type: "fontFamily" },
      { key: "fontSize", label: "Size", type: "number", unit: "px" },
      { key: "fontWeight", label: "Weight", type: "fontWeight" },
      { key: "lineHeight", label: "Line Height", type: "number", unit: "em", step: "0.1" },
      { key: "letterSpacing", label: "Spacing", type: "number", unit: "px", step: "0.5" },
      { key: "textColor", label: "Color", type: "color" },
      { key: "textAlign", label: "Align", type: "textAlign" },
      { key: "textTransform", label: "Transform", type: "textTransform" },
    ],
  },
  {
    group: "Spacing",
    icon: "box",
    fields: [
      { key: "paddingTop", label: "Pad Top", type: "number", unit: "px" },
      { key: "paddingBottom", label: "Pad Bottom", type: "number", unit: "px" },
      { key: "paddingLeft", label: "Pad Left", type: "number", unit: "px" },
      { key: "paddingRight", label: "Pad Right", type: "number", unit: "px" },
      { key: "marginTop", label: "Margin Top", type: "number", unit: "px" },
      { key: "marginBottom", label: "Margin Bottom", type: "number", unit: "px" },
    ],
  },
  {
    group: "Background",
    icon: "image",
    fields: [
      { key: "backgroundColor", label: "Color", type: "color" },
      { key: "bgGradient", label: "CSS Gradient", type: "text", placeholder: "linear-gradient(135deg, #1e1b4b, #312e81)" },
    ],
  },
  {
    group: "Border",
    icon: "square",
    fields: [
      { key: "borderRadius", label: "Radius", type: "number", unit: "px" },
      { key: "borderWidth", label: "Width", type: "number", unit: "px" },
      { key: "borderColor", label: "Color", type: "color" },
      { key: "borderStyle", label: "Style", type: "select", options: [
        { value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" },
        { value: "dotted", label: "Dotted" }, { value: "none", label: "None" },
      ]},
    ],
  },
  {
    group: "Shadow & Effects",
    icon: "layers",
    fields: [
      { key: "boxShadow", label: "Box Shadow", type: "text", placeholder: "0 4px 12px rgba(0,0,0,0.1)" },
      { key: "opacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    group: "Size & Overflow",
    icon: "maximize",
    fields: [
      { key: "minHeight", label: "Min Height", type: "number", unit: "px" },
      { key: "maxWidth", label: "Max Width", type: "number", unit: "px" },
      { key: "overflow", label: "Overflow", type: "select", options: [
        { value: "visible", label: "Visible" }, { value: "hidden", label: "Hidden" },
        { value: "auto", label: "Auto" }, { value: "scroll", label: "Scroll" },
      ]},
    ],
  },
];

/* ── Helper: convert style object → inline CSS ── */
export function blockStyleToCSS(s = {}) {
  const v = { ...DEFAULT_BLOCK_STYLE, ...s };
  const css = {};

  // Spacing
  if (v.paddingTop)    css.paddingTop = `${v.paddingTop}px`;
  if (v.paddingBottom) css.paddingBottom = `${v.paddingBottom}px`;
  if (v.paddingLeft)   css.paddingLeft = `${v.paddingLeft}px`;
  if (v.paddingRight)  css.paddingRight = `${v.paddingRight}px`;
  if (v.marginTop && v.marginTop !== "0") css.marginTop = `${v.marginTop}px`;
  if (v.marginBottom && v.marginBottom !== "0") css.marginBottom = `${v.marginBottom}px`;

  // Background
  if (v.bgGradient)          css.background = v.bgGradient;
  else if (v.backgroundColor) css.backgroundColor = v.backgroundColor;

  // Border
  if (v.borderRadius) css.borderRadius = `${v.borderRadius}px`;
  if (Number(v.borderWidth) > 0) css.border = `${v.borderWidth}px ${v.borderStyle || 'solid'} ${v.borderColor}`;

  // Shadow
  if (v.boxShadow) css.boxShadow = v.boxShadow;

  // Size
  if (v.minHeight) css.minHeight = `${v.minHeight}px`;
  if (v.maxWidth) css.maxWidth = `${v.maxWidth}px`;
  if (v.overflow && v.overflow !== 'visible') css.overflow = v.overflow;

  // Typography
  if (v.fontFamily) css.fontFamily = v.fontFamily;
  if (v.fontSize) css.fontSize = `${v.fontSize}px`;
  if (v.fontWeight) css.fontWeight = v.fontWeight;
  if (v.lineHeight) css.lineHeight = v.lineHeight.includes?.('.') ? v.lineHeight : `${v.lineHeight}`;
  if (v.letterSpacing) css.letterSpacing = `${v.letterSpacing}px`;
  if (v.textColor) css.color = v.textColor;
  if (v.textAlign) css.textAlign = v.textAlign;
  if (v.textTransform && v.textTransform !== 'none') css.textTransform = v.textTransform;

  // Opacity
  if (v.opacity && v.opacity !== "1") css.opacity = v.opacity;

  return css;
}

/* ═══════════════════════════════════════════════════
   Block render components
   ═══════════════════════════════════════════════════ */

const TAG_FONT_SIZES = { h1: "5em", h2: "4em", h3: "3em", h4: "2em", h5: "1em", h6: "0.90em" };

function DynTag({ tag = "div", style, children }) {
  const Tag = HEADING_TAGS.includes(tag) ? tag : "div";
  const merged = { fontSize: TAG_FONT_SIZES[Tag], ...style };
  return <Tag style={merged}>{children}</Tag>;
}

export function HeroBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${data.bgGradientFrom || "#1e1b4b"} 0%, ${data.bgGradientTo || "#312e81"} 100%)`,
        borderRadius: mobile ? 8 : 12,
        padding: mobile ? "20px 16px" : tablet ? "28px 24px" : "32px 28px",
        textAlign: "center",
      }}
    >
      <DynTag
        tag={data.titleTag || "h2"}
        style={{
          color: "#fff", fontSize: mobile ? 17 : tablet ? 20 : 22, fontWeight: 600, marginBottom: 8,
          fontFamily: "'DM Serif Display', Georgia, serif",
        }}
      >
        {data.title}
      </DynTag>
      <p style={{ color: "rgba(255,255,255,0.65)", fontSize: mobile ? 12 : 13, marginBottom: 20, maxWidth: mobile ? "100%" : 380, margin: "0 auto 20px", lineHeight: 1.6 }}>
        {data.subtitle}
      </p>
      {data.ctaLabel && (
        <button style={{ background: data.ctaColor || "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: mobile ? "8px 18px" : "10px 24px", fontSize: mobile ? 12 : 13, fontWeight: 500, cursor: "pointer" }}>
          {data.ctaLabel}
        </button>
      )}
    </div>
  );
}

export function StatsBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const stats = [
    { value: data.stat1Value, label: data.stat1Label },
    { value: data.stat2Value, label: data.stat2Label },
    { value: data.stat3Value, label: data.stat3Label },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : tablet ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: mobile ? 8 : 10 }}>
      {stats.map((s, i) => (
        <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: mobile ? "12px 10px" : "14px 12px", textAlign: "center" }}>
          <DynTag tag={data.valueTag || "div"} style={{ fontSize: mobile ? 18 : 22, fontWeight: 600, color: "#1e293b", fontFamily: "'DM Serif Display', Georgia, serif" }}>
            {s.value}
          </DynTag>
          <div style={{ fontSize: mobile ? 10 : 11, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

export function ChartBlock({ data }) {
  const { mobile } = useResponsive();
  const values = [65,82,74,91,58,78,88,70,94,62,85,79];
  const months = ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const max = Math.max(...values);
  const barH = mobile ? 48 : 58;
  return (
    <div>
      <DynTag tag={data.titleTag || "p"} style={{ fontSize: mobile ? 12 : 13, fontWeight: 600, color: "#1e293b", marginBottom: mobile ? 8 : 12 }}>
        {data.title}
      </DynTag>
      <div style={{ display: "flex", alignItems: "flex-end", gap: mobile ? 3 : 5, height: mobile ? 56 : 72 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: mobile ? 2 : 3 }}>
            <div style={{ width: "100%", height: Math.round((v / max) * barH), background: data.color || "#4f46e5", borderRadius: "3px 3px 0 0", opacity: 0.8, transition: "height 0.3s" }} />
            <span style={{ fontSize: mobile ? 7 : 9, color: "#94a3b8" }}>{months[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableBlock({ data }) {
  const { mobile } = useResponsive();
  const rows = [
    { id: "#4521", name: "Priya Sharma", amount: "$240", status: "Paid", color: "#16a34a" },
    { id: "#4520", name: "James Liu", amount: "$85", status: "Pending", color: "#d97706" },
    { id: "#4519", name: "Sofia Reyes", amount: "$320", status: "Paid", color: "#16a34a" },
    { id: "#4518", name: "Ravi Mehta", amount: "$150", status: "Failed", color: "#dc2626" },
  ];
  return (
    <div>
      <DynTag tag={data.titleTag || "p"} style={{ fontSize: mobile ? 12 : 13, fontWeight: 600, color: "#1e293b", marginBottom: mobile ? 8 : 10 }}>
        {data.title}
      </DynTag>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: mobile ? 11 : 12, minWidth: mobile ? 420 : "auto" }}>
          <thead>
            <tr>
              {["Order","Customer","Amount","Status"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: mobile ? "5px 6px" : "6px 8px", fontSize: mobile ? 9 : 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: mobile ? 6 : 8, borderBottom: "1px solid #f8fafc", color: "#64748b", whiteSpace: "nowrap" }}>{r.id}</td>
                <td style={{ padding: mobile ? 6 : 8, borderBottom: "1px solid #f8fafc", fontWeight: 500, color: "#1e293b", whiteSpace: "nowrap" }}>{r.name}</td>
                <td style={{ padding: mobile ? 6 : 8, borderBottom: "1px solid #f8fafc", color: "#475569" }}>{r.amount}</td>
                <td style={{ padding: mobile ? 6 : 8, borderBottom: "1px solid #f8fafc" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: mobile ? 10 : 11, color: r.color, fontWeight: 500 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardsBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const cards = [
    { title: data.card1Title, desc: data.card1Desc, icon: "\u{1F4CA}" },
    { title: data.card2Title, desc: data.card2Desc, icon: "\u{1F517}" },
    { title: data.card3Title, desc: data.card3Desc, icon: "\u26A1" },
    { title: data.card4Title, desc: data.card4Desc, icon: "\u{1F512}" },
  ];
  const desiredCols = parseInt(data.columns) || 2;
  const cols = mobile ? 1 : tablet ? Math.min(desiredCols, 2) : desiredCols;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: mobile ? 8 : 10 }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: mobile ? "10px 12px" : "12px 14px" }}>
          <div style={{ fontSize: mobile ? 16 : 18, marginBottom: mobile ? 4 : 6 }}>{c.icon}</div>
          <div style={{ fontSize: mobile ? 12 : 13, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{c.title}</div>
          <div style={{ fontSize: mobile ? 10 : 11, color: "#94a3b8", lineHeight: 1.5 }}>{c.desc}</div>
        </div>
      ))}
    </div>
  );
}

export function NoticeBlock({ data }) {
  const { mobile } = useResponsive();
  const variants = {
    info:    { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", icon: "\u2139\uFE0F" },
    warning: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", icon: "\u26A0\uFE0F" },
    success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", icon: "\u2705" },
  };
  const v = variants[data.variant] || variants.info;
  return (
    <div style={{ background: v.bg, border: `1px solid ${v.border}`, borderRadius: mobile ? 8 : 10, padding: mobile ? "10px 12px" : "12px 16px", display: "flex", gap: mobile ? 8 : 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: mobile ? 14 : 16, flexShrink: 0 }}>{v.icon}</span>
      <p style={{ fontSize: mobile ? 11 : 12, color: v.color, lineHeight: 1.6, margin: 0 }}>{data.message}</p>
    </div>
  );
}

export function TextBlock({ data }) {
  const { mobile } = useResponsive();
  const headingPx = data.headingSize ? parseInt(data.headingSize) : 16;
  const bodyPx = data.bodySize ? parseInt(data.bodySize) : 13;
  return (
    <div style={{ textAlign: data.textAlign || "left" }}>
      <DynTag
        tag={data.headingTag || "h3"}
        style={{
          fontSize: mobile ? Math.max(headingPx * 0.85, 13) : headingPx,
          fontWeight: 600,
          color: data.headingColor || "#1e293b",
          marginBottom: mobile ? 6 : 8,
          fontFamily: "'DM Serif Display', Georgia, serif",
        }}
      >
        {data.heading}
      </DynTag>
      <p style={{ fontSize: mobile ? Math.max(bodyPx * 0.9, 11) : bodyPx, color: data.bodyColor || "#64748b", lineHeight: 1.7, margin: 0 }}>
        {data.body}
      </p>
    </div>
  );
}

export function ImageBannerBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const opacity = parseFloat(data.overlayOpacity) || 0.5;
  const hasImage = data.image && data.image.length > 0;
  const height = parseInt(data.minHeight) || 160;
  const scaledH = mobile ? Math.max(height * 0.65, 120) : tablet ? Math.max(height * 0.8, 140) : height;
  return (
    <div style={{ position: "relative", borderRadius: mobile ? 8 : 12, overflow: "hidden", minHeight: scaledH, display: "flex", alignItems: "center", justifyContent: "center", background: hasImage ? "none" : "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
      {hasImage && <img src={data.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${opacity})` }} />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: mobile ? "20px 16px" : "32px 24px" }}>
        <DynTag tag={data.titleTag || "h2"} style={{ color: "#fff", fontSize: mobile ? 16 : tablet ? 18 : 20, fontWeight: 700, marginBottom: 8, fontFamily: "'DM Serif Display', Georgia, serif" }}>
          {data.title}
        </DynTag>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: mobile ? 11 : 13, maxWidth: mobile ? "100%" : 380, margin: "0 auto 18px", lineHeight: 1.6 }}>{data.subtitle}</p>
        {data.ctaLabel && (
          <button style={{ background: data.ctaColor || "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: mobile ? "8px 18px" : "10px 24px", fontSize: mobile ? 12 : 13, fontWeight: 500, cursor: "pointer" }}>
            {data.ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function GridBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const rows = Math.max(1, Math.min(parseInt(data.rows) || 1, 6));
  const columns = Math.max(1, Math.min(parseInt(data.columns) || 2, 6));
  const totalCells = Math.min(rows * columns, 12);
  const desiredCols = columns;
  const cols = mobile ? 1 : tablet ? Math.min(desiredCols, 2) : desiredCols;
  const gap = parseInt(data.gap) || 10;
  const cellHeight = parseInt(data.cellMinHeight) || 120;
  const scaledCellH = mobile ? Math.max(cellHeight * 0.7, 80) : cellHeight;
  const cellFontSize = parseInt(data.cellFontSize) || 12;

  const cells = [];
  for (let i = 1; i <= totalCells; i++) {
    cells.push({
      image: data[`cell${i}Image`] || "",
      imageHeight: data[`cell${i}ImageHeight`] || "",
      heading: data[`cell${i}Heading`] || "",
      headingTag: data[`cell${i}HeadingTag`] || "h3",
      text: data[`cell${i}Text`] || "",
      btnLabel: data[`cell${i}BtnLabel`] || "",
      btnUrl: data[`cell${i}BtnUrl`] || "",
      btnBgColor: data[`cell${i}BtnBgColor`] || "#4f46e5",
      btnTextColor: data[`cell${i}BtnTextColor`] || "#ffffff",
      bgColor: data[`cell${i}BgColor`] || "#f8fafc",
      borderColor: data[`cell${i}BorderColor`] || "#e2e8f0",
      borderRadius: parseInt(data[`cell${i}BorderRadius`]) || 10,
      paddingTop: parseInt(data[`cell${i}PaddingTop`]) || 12,
      paddingBottom: parseInt(data[`cell${i}PaddingBottom`]) || 12,
      paddingLeft: parseInt(data[`cell${i}PaddingLeft`]) || 12,
      paddingRight: parseInt(data[`cell${i}PaddingRight`]) || 12,
      marginTop: parseInt(data[`cell${i}MarginTop`]) || 0,
      marginBottom: parseInt(data[`cell${i}MarginBottom`]) || 0,
      marginLeft: parseInt(data[`cell${i}MarginLeft`]) || 0,
      marginRight: parseInt(data[`cell${i}MarginRight`]) || 0,
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: mobile ? Math.min(gap, 8) : gap }}>
      {cells.map((cell, i) => {
        const radius = mobile ? Math.min(cell.borderRadius, 8) : cell.borderRadius;
        const hasContent = cell.image || cell.heading || cell.text || cell.btnLabel;
        const imgH = cell.imageHeight ? parseInt(cell.imageHeight) : scaledCellH;
        return (
          <div
            key={i}
            style={{
              background: cell.bgColor,
              border: `1px solid ${cell.borderColor}`,
              borderRadius: radius,
              minHeight: scaledCellH,
              overflow: "hidden",
              marginTop: cell.marginTop,
              marginBottom: cell.marginBottom,
              marginLeft: cell.marginLeft,
              marginRight: cell.marginRight,
            }}
          >
            {!hasContent ? (
              <div style={{ minHeight: scaledCellH, display: "flex", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: mobile ? 10 : 11 }}>
                Cell {i + 1}
              </div>
            ) : (
              <>
                {/* Image */}
                {cell.image && (
                  <img src={cell.image} alt="" style={{
                    width: "100%", height: imgH, objectFit: "cover", display: "block",
                    borderRadius: `${radius}px ${radius}px 0 0`,
                  }} />
                )}
                {/* Text content + Button */}
                {(cell.heading || cell.text || cell.btnLabel) && (
                  <div style={{
                    paddingTop: mobile ? Math.min(cell.paddingTop, 10) : cell.paddingTop,
                    paddingBottom: mobile ? Math.min(cell.paddingBottom, 10) : cell.paddingBottom,
                    paddingLeft: mobile ? Math.min(cell.paddingLeft, 10) : cell.paddingLeft,
                    paddingRight: mobile ? Math.min(cell.paddingRight, 10) : cell.paddingRight,
                  }}>
                    {cell.heading && (
                      <DynTag tag={cell.headingTag} style={{
                        fontWeight: 600, color: "#1e293b",
                        marginBottom: (cell.text || cell.btnLabel) ? 6 : 0,
                        fontFamily: "'DM Serif Display', Georgia, serif",
                      }}>
                        {cell.heading}
                      </DynTag>
                    )}
                    {cell.text && (
                      <p style={{ fontSize: mobile ? Math.max(cellFontSize - 1, 10) : cellFontSize, color: "#334155", lineHeight: 1.5, margin: 0, marginBottom: cell.btnLabel ? 10 : 0 }}>
                        {cell.text}
                      </p>
                    )}
                    {cell.btnLabel && (
                      <a href={cell.btnUrl || "#"} style={{
                        display: "inline-block", background: cell.btnBgColor, color: cell.btnTextColor,
                        padding: mobile ? "6px 14px" : "8px 18px", fontSize: mobile ? 11 : 13,
                        fontWeight: 600, borderRadius: 6, textDecoration: "none", cursor: "pointer",
                      }}>
                        {cell.btnLabel}
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImageSliderBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef(null);
  const slideCount = Math.min(parseInt(data.slideCount) || 3, 5);
  const baseHeight = parseInt(data.minHeight) || 500;
  const height = mobile ? Math.max(baseHeight * 0.5, 220) : tablet ? Math.max(baseHeight * 0.7, 300) : baseHeight;
  const opacity = parseFloat(data.overlayOpacity) || 0.4;
  const autoPlay = data.autoPlay !== "false";
  const speed = (parseFloat(data.autoPlaySpeed) || 5) * 1000;
  const transition = parseFloat(data.transitionSpeed) || 0.6;
  const showDots = data.showDots !== "false";
  const showArrows = data.showArrows !== "false";

  const slides = [];
  for (let i = 1; i <= slideCount; i++) {
    slides.push({
      image: data[`slide${i}Image`] || "",
      title: data[`slide${i}Title`] || "",
      subtitle: data[`slide${i}Subtitle`] || "",
      ctaLabel: data[`slide${i}CtaLabel`] || "",
      ctaUrl: data[`slide${i}CtaUrl`] || "#",
    });
  }

  useEffect(() => {
    if (!autoPlay || slides.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, speed);
    return () => clearInterval(intervalRef.current);
  }, [autoPlay, speed, slides.length]);

  const goTo = (index) => {
    setCurrent(index);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoPlay && slides.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
      }, speed);
    }
  };

  const goPrev = () => goTo((current - 1 + slides.length) % slides.length);
  const goNext = () => goTo((current + 1) % slides.length);

  const arrowSize = mobile ? 34 : tablet ? 40 : 48;
  const arrowOffset = mobile ? 8 : tablet ? 14 : 20;
  const arrowBtn = (direction) => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [direction === "left" ? "left" : "right"]: arrowOffset,
    zIndex: 3,
    background: "rgba(255,255,255,0.15)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
    width: arrowSize,
    height: arrowSize,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: mobile ? 16 : 20,
    transition: "background 0.2s",
    padding: 0,
  });

  const titleSize = mobile ? 22 : tablet ? 32 : 42;
  const subtitleSize = mobile ? 13 : tablet ? 15 : 18;
  const ctaPad = mobile ? "10px 22px" : tablet ? "12px 28px" : "14px 36px";
  const ctaFont = mobile ? 12 : tablet ? 13 : 15;
  const contentPad = mobile ? "20px 16px" : tablet ? "30px 32px" : "40px 60px";

  return (
    <div style={{ position: "relative", width: "100%", height, overflow: "hidden", borderRadius: mobile ? 8 : 12 }}>
      {/* Slides */}
      <div style={{ display: "flex", width: `${slides.length * 100}%`, height: "100%", transition: `transform ${transition}s ease-in-out`, transform: `translateX(-${(current * 100) / slides.length}%)` }}>
        {slides.map((slide, i) => (
          <div key={i} style={{ width: `${100 / slides.length}%`, height: "100%", position: "relative", flexShrink: 0 }}>
            {slide.image ? (
              <img src={slide.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${["#1e1b4b","#064e3b","#7c2d12","#1e3a5f","#3b0764"][i % 5]} 0%, ${["#312e81","#065f46","#9a3412","#1e40af","#581c87"][i % 5]} 100%)` }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${opacity})` }} />
            <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: contentPad }}>
              {slide.title && (
                <DynTag tag={data.titleTag || "h1"} style={{ color: "#fff", fontSize: titleSize, fontWeight: 800, marginBottom: mobile ? 10 : 16, fontFamily: "'DM Serif Display', Georgia, serif", textShadow: "0 2px 20px rgba(0,0,0,0.3)", lineHeight: 1.2 }}>
                  {slide.title}
                </DynTag>
              )}
              {slide.subtitle && (
                <p style={{ color: "rgba(255,255,255,0.85)", fontSize: subtitleSize, maxWidth: mobile ? "100%" : 600, margin: mobile ? "0 auto 16px" : "0 auto 28px", lineHeight: 1.6, textShadow: "0 1px 10px rgba(0,0,0,0.2)" }}>
                  {slide.subtitle}
                </p>
              )}
              {slide.ctaLabel && (
                <a href={slide.ctaUrl || "#"} style={{ display: "inline-block", background: data.ctaColor || "#4f46e5", color: "#fff", border: "none", borderRadius: mobile ? 8 : 10, padding: ctaPad, fontSize: ctaFont, fontWeight: 600, cursor: "pointer", textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", transition: "transform 0.2s" }}>
                  {slide.ctaLabel}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Arrows */}
      {showArrows && slides.length > 1 && (
        <>
          <button onClick={goPrev} style={arrowBtn("left")}>{"\u2039"}</button>
          <button onClick={goNext} style={arrowBtn("right")}>{"\u203A"}</button>
        </>
      )}

      {/* Dots */}
      {showDots && slides.length > 1 && (
        <div style={{ position: "absolute", bottom: mobile ? 12 : 20, left: "50%", transform: "translateX(-50%)", zIndex: 3, display: "flex", gap: mobile ? 6 : 8 }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: current === i ? (mobile ? 20 : 28) : (mobile ? 8 : 10),
                height: mobile ? 8 : 10,
                borderRadius: 5,
                border: "none",
                background: current === i ? "#fff" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                transition: "all 0.3s",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Mini image carousel for each property card */
function CardImageSlider({ images, height, alt, mobile }) {
  const [idx, setIdx] = useState(0);
  const touchStart = useRef(null);
  const count = images.length;

  if (count === 0) {
    return (
      <div style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: mobile ? 11 : 13, background: "#e2e8f0" }}>
        No Image
      </div>
    );
  }

  const go = (dir) => { setIdx((i) => (i + dir + count) % count); };

  return (
    <div
      style={{ width: "100%", height, position: "relative", background: "#e2e8f0", overflow: "hidden" }}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStart.current === null) return;
        const diff = e.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(diff) > 40) go(diff < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <img src={images[idx]} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

      {count > 1 && (
        <>
          {/* Left / Right arrows */}
          <button onClick={(e) => { e.stopPropagation(); go(-1); }} style={{
            position: "absolute", top: "50%", left: 4, transform: "translateY(-50%)",
            width: mobile ? 22 : 26, height: mobile ? 22 : 26, borderRadius: "50%",
            background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: mobile ? 12 : 14, lineHeight: 1, padding: 0,
          }}>&#8249;</button>
          <button onClick={(e) => { e.stopPropagation(); go(1); }} style={{
            position: "absolute", top: "50%", right: 4, transform: "translateY(-50%)",
            width: mobile ? 22 : 26, height: mobile ? 22 : 26, borderRadius: "50%",
            background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: mobile ? 12 : 14, lineHeight: 1, padding: 0,
          }}>&#8250;</button>

          {/* Dots */}
          <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
            {images.map((_, i) => (
              <span key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} style={{
                width: mobile ? 5 : 6, height: mobile ? 5 : 6, borderRadius: "50%",
                background: i === idx ? "#fff" : "rgba(255,255,255,0.5)",
                cursor: "pointer", transition: "background 0.2s",
              }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PropertiesSliderBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const intervalRef = useRef(null);

  const badgeColor = data.badgeColor || "#dc2626";
  const ctaColor = data.ctaColor || "#dc2626";
  const maxProps = parseInt(data.maxProperties) || 10;
  const autoScroll = data.autoScroll !== "false";
  const scrollSpeed = (parseFloat(data.scrollSpeed) || 3) * 1000;

  const cardW = mobile ? 240 : tablet ? 270 : 300;
  const cardGap = mobile ? 12 : 20;
  const imgH = mobile ? 150 : 200;
  const arrowSize = mobile ? 28 : 36;

  useEffect(() => {
    let cancelled = false;
    // Use admin-selected properties if available
    const saved = (() => {
      try {
        const parsed = typeof data.selectedProperties === 'string'
          ? JSON.parse(data.selectedProperties)
          : data.selectedProperties;
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
      } catch { return null; }
    })();

    if (saved) {
      setProperties(saved.slice(0, maxProps));
      setLoading(false);
    } else {
      dealsAPI.getPublishedDeals().then((deals) => {
        if (!cancelled) {
          setProperties(deals.slice(0, maxProps));
          setLoading(false);
        }
      }).catch(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [maxProps, data.selectedProperties]);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current || properties.length === 0) return;
    intervalRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: cardW + cardGap, behavior: "smooth" });
      }
    }, scrollSpeed);
    return () => clearInterval(intervalRef.current);
  }, [autoScroll, scrollSpeed, properties.length, cardW, cardGap]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * (cardW + cardGap), behavior: "smooth" });
  };

  const formatPrice = (price) => {
    const num = parseFloat(price);
    if (isNaN(num)) return "Price On Request";
    if (num >= 10000000) return `Rs. ${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `Rs. ${(num / 100000).toFixed(2)} Lac`;
    return `Rs. ${num.toLocaleString("en-IN")}`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: mobile ? "24px 12px" : "40px 20px" }}>
        <div style={{ fontSize: mobile ? 12 : 14, color: "#94a3b8" }}>Loading properties...</div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: mobile ? "24px 12px" : "40px 20px" }}>
        <div style={{ fontSize: mobile ? 12 : 14, color: "#94a3b8" }}>No properties available</div>
      </div>
    );
  }

  return (
    <div style={{ padding: mobile ? "20px 0" : "40px 0", background: "#f8f9fa" }}>
      {/* Section Header */}
      <div style={{ textAlign: "center", marginBottom: mobile ? 18 : 32 }}>
        {data.sectionTitle && (
          <div style={{ fontSize: mobile ? 18 : tablet ? 21 : 24, color: "#6b7280", fontFamily: "'DM Serif Display', Georgia, serif", marginBottom: 4 }}>
            {data.sectionTitle}
          </div>
        )}
        {data.sectionSubtitle && (
          <div style={{ fontSize: mobile ? 20 : tablet ? 24 : 28, fontWeight: 800, color: "#1e293b", letterSpacing: "0.05em" }}>
            {data.sectionSubtitle}
          </div>
        )}
      </div>

      {/* Slider Container */}
      <div style={{ position: "relative" }}>
        {/* Left Arrow */}
        {!mobile && (
          <button
            onClick={() => scroll(-1)}
            style={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", zIndex: 2,
              width: arrowSize, height: arrowSize, borderRadius: "50%", border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontSize: mobile ? 14 : 18, color: "#475569", padding: 0,
            }}
          >
            &#8249;
          </button>
        )}

        {/* Right Arrow */}
        {!mobile && (
          <button
            onClick={() => scroll(1)}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", zIndex: 2,
              width: arrowSize, height: arrowSize, borderRadius: "50%", border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontSize: mobile ? 14 : 18, color: "#475569", padding: 0,
            }}
          >
            &#8250;
          </button>
        )}

        {/* Scrollable Cards */}
        <div
          ref={scrollRef}
          onMouseEnter={() => clearInterval(intervalRef.current)}
          onMouseLeave={() => {
            if (!autoScroll || properties.length === 0) return;
            intervalRef.current = setInterval(() => {
              const el = scrollRef.current;
              if (!el) return;
              if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
                el.scrollTo({ left: 0, behavior: "smooth" });
              } else {
                el.scrollBy({ left: cardW + cardGap, behavior: "smooth" });
              }
            }, scrollSpeed);
          }}
          style={{
            display: "flex", gap: cardGap, overflowX: "auto", scrollBehavior: "smooth",
            padding: mobile ? "0 16px 12px" : "0 48px 16px", scrollbarWidth: "none", msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {properties.map((prop) => {
            const allImages = [
              ...(Array.isArray(prop.exteriorImages) ? prop.exteriorImages : []),
              ...(Array.isArray(prop.interiorImages) ? prop.interiorImages : []),
              ...(Array.isArray(prop.additionalImages) ? prop.additionalImages : []),
              ...(Array.isArray(prop.images) ? prop.images : []),
            ].filter(Boolean);
            const title = prop.title || "Untitled Property";
            const address = prop.address || "";
            const price = prop.discountedPrice || prop.price;
            const bedrooms = prop.bedrooms;
            const sqft = prop.squareFootage;

            return (
              <div
                key={prop.id}
                style={{
                  minWidth: cardW, maxWidth: cardW, borderRadius: mobile ? 10 : 12, overflow: "hidden",
                  background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  flexShrink: 0, display: "flex", flexDirection: "column",
                }}
              >
                {/* Image Section */}
                <div style={{ position: "relative", height: imgH, background: "#e2e8f0", overflow: "hidden" }}>
                  <CardImageSlider images={allImages} height={imgH} alt={title} mobile={mobile} />
                  {data.badgeText && (
                    <div style={{
                      position: "absolute", top: mobile ? 8 : 12, left: -6, background: badgeColor,
                      color: "#fff", fontSize: mobile ? 9 : 11, fontWeight: 700, padding: mobile ? "4px 10px 4px 10px" : "5px 14px 5px 12px",
                      borderRadius: "0 4px 4px 0", letterSpacing: "0.05em",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                    }}>
                      {data.badgeText}
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div style={{ padding: mobile ? "10px 12px" : "14px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ marginBottom: mobile ? 6 : 10 }}>
                    <div style={{ fontSize: mobile ? 13 : 15, fontWeight: 600, color: "#2563eb", marginBottom: 4, lineHeight: 1.3 }}>
                      {title}
                    </div>
                    {address && (
                      <div style={{ fontSize: mobile ? 10 : 12, color: "#6b7280", display: "flex", alignItems: "flex-start", gap: 4 }}>
                        <span style={{ color: "#dc2626", fontSize: mobile ? 11 : 13, flexShrink: 0 }}>&#9679;</span>
                        <span>{address}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: mobile ? 14 : 16, fontWeight: 700, color: "#1e293b", marginBottom: mobile ? 6 : 10 }}>
                    {price ? `${formatPrice(price)} Onwards` : "Price On Request"}
                  </div>

                  <div style={{ display: "flex", gap: mobile ? 10 : 16, fontSize: mobile ? 10 : 12, color: "#6b7280", marginBottom: mobile ? 8 : 14 }}>
                    {bedrooms && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: mobile ? 12 : 14 }}>&#127968;</span>
                        <span>{bedrooms} BHK</span>
                      </div>
                    )}
                    {sqft && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: mobile ? 12 : 14 }}>&#128196;</span>
                        <span>{sqft} Sq ft.</span>
                      </div>
                    )}
                  </div>

                  {data.ctaLabel && (
                    <div style={{ marginTop: "auto" }}>
                      <button
                        onClick={() => navigate(`/deal-details/${prop.id}`)}
                        style={{
                          background: "none", border: "none", color: ctaColor,
                          fontSize: mobile ? 11 : 12, fontWeight: 700, cursor: "pointer", padding: 0,
                          display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.03em",
                        }}
                      >
                        {data.ctaLabel} <span style={{ fontSize: mobile ? 14 : 16 }}>&rarr;</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ParagraphBlock({ data }) {
  const { mobile } = useResponsive();
  const bodyPx = data.bodySize ? parseInt(data.bodySize) : 14;
  const fontSize = mobile ? Math.max(bodyPx * 0.9, 12) : bodyPx;
  const align = data.textAlign || "left";
  const hasImage = data.image && data.image.length > 0;
  const showBtn = data.showButton === "yes" && data.btnLabel;
  const imgPos = data.imagePosition || "top";
  const imgMaxW = parseInt(data.imageMaxWidth) || 100;
  const imgRadius = parseInt(data.imageBorderRadius) || 8;
  const btnRadius = parseInt(data.btnBorderRadius) || 8;
  const btnPad = data.btnSize === "large" ? "12px 32px" : data.btnSize === "small" ? "6px 16px" : "9px 24px";
  const btnFontSize = data.btnSize === "large" ? 15 : data.btnSize === "small" ? 12 : 13;
  const isHorizontal = (imgPos === "left" || imgPos === "right") && hasImage;

  const imageEl = hasImage ? (
    <img
      src={data.image}
      alt=""
      style={{
        maxWidth: isHorizontal ? `${imgMaxW}%` : `${imgMaxW}%`,
        width: "100%",
        borderRadius: imgRadius,
        display: "block",
        flexShrink: 0,
      }}
    />
  ) : null;

  const textEl = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        className="paragraph-block-content"
        style={{
          textAlign: align,
          color: data.bodyColor || "#374151",
          fontSize,
          lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: data.content || "" }}
      />
      {showBtn && (
        <div style={{ textAlign: align, marginTop: 16 }}>
          <a
            href={data.btnUrl || "#"}
            style={{
              display: "inline-block",
              background: data.btnBgColor || "#4f46e5",
              color: data.btnTextColor || "#ffffff",
              padding: btnPad,
              borderRadius: btnRadius,
              fontSize: btnFontSize,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {data.btnLabel}
          </a>
        </div>
      )}
    </div>
  );

  if (isHorizontal) {
    return (
      <div style={{
        display: "flex",
        flexDirection: mobile ? "column" : (imgPos === "left" ? "row" : "row-reverse"),
        gap: 24,
        alignItems: "flex-start",
      }}>
        <div style={{ width: mobile ? "100%" : `${Math.min(imgMaxW, 50)}%`, flexShrink: 0 }}>
          {imageEl}
        </div>
        {textEl}
      </div>
    );
  }

  return (
    <div>
      {imgPos === "top" && imageEl && <div style={{ marginBottom: 16, textAlign: align }}>{imageEl}</div>}
      {textEl}
      {imgPos === "bottom" && imageEl && <div style={{ marginTop: 16, textAlign: align }}>{imageEl}</div>}
    </div>
  );
}

export function ImageSectionBlock({ data }) {
  const { mobile, tablet } = useResponsive();
  const hasImage = data.image && data.image.length > 0;
  const opacity = parseFloat(data.overlayOpacity) || 0.45;
  const height = parseInt(data.minHeight) || 280;
  const scaledH = mobile ? Math.max(height * 0.6, 160) : tablet ? Math.max(height * 0.8, 200) : height;
  const titleSize = parseInt(data.titleSize) || 28;
  const subtitleSize = parseInt(data.subtitleSize) || 14;
  const align = data.textAlign || "center";
  const btnRadius = parseInt(data.btnBorderRadius) || 8;
  const btnPad = data.btnSize === "large" ? "12px 32px" : data.btnSize === "small" ? "6px 16px" : "9px 24px";
  const btnFontSize = data.btnSize === "large" ? 15 : data.btnSize === "small" ? 12 : 13;

  return (
    <div style={{
      position: "relative", borderRadius: mobile ? 8 : 12, overflow: "hidden",
      minHeight: scaledH, display: "flex", alignItems: "center", justifyContent: "center",
      background: hasImage ? "none" : "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
    }}>
      {hasImage && <img src={data.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${opacity})` }} />
      <div style={{ position: "relative", zIndex: 1, textAlign: align, padding: mobile ? "24px 16px" : "40px 32px", width: "100%" }}>
        {data.title && (
          <DynTag tag={data.titleTag || "h2"} style={{
            color: data.titleColor || "#ffffff",
            fontSize: mobile ? Math.max(titleSize * 0.7, 16) : titleSize,
            fontWeight: 700, marginBottom: 10,
            fontFamily: "'DM Serif Display', Georgia, serif",
          }}>
            {data.title}
          </DynTag>
        )}
        {data.subtitle && (
          <p style={{
            color: data.subtitleColor || "rgba(255,255,255,0.8)",
            fontSize: mobile ? Math.max(subtitleSize * 0.85, 11) : subtitleSize,
            maxWidth: mobile ? "100%" : 480, margin: align === "center" ? "0 auto 20px" : "0 0 20px 0",
            lineHeight: 1.7,
          }}>
            {data.subtitle}
          </p>
        )}
        {data.showButton === "yes" && data.btnLabel && (
          <a href={data.btnUrl || "#"} style={{
            display: "inline-block",
            background: data.btnBgColor || "#4f46e5",
            color: data.btnTextColor || "#ffffff",
            padding: btnPad, fontSize: btnFontSize, fontWeight: 600,
            borderRadius: btnRadius, textDecoration: "none", cursor: "pointer",
          }}>
            {data.btnLabel}
          </a>
        )}
      </div>
    </div>
  );
}

export function BlockPreviewContent({ type, data }) {
  switch (type) {
    case "hero":        return <HeroBlock data={data} />;
    case "stats":       return <StatsBlock data={data} />;
    case "chart":       return <ChartBlock data={data} />;
    case "table":       return <TableBlock data={data} />;
    case "cards":       return <CardsBlock data={data} />;
    case "notice":      return <NoticeBlock data={data} />;
    case "text":        return <TextBlock data={data} />;
    case "imageBanner": return <ImageBannerBlock data={data} />;
    case "grid":              return <GridBlock data={data} />;
    case "imageSlider":       return <ImageSliderBlock data={data} />;
    case "propertiesSlider":  return <PropertiesSliderBlock data={data} />;
    case "paragraph":         return <ParagraphBlock data={data} />;
    case "imageSection":      return <ImageSectionBlock data={data} />;
    default:                  return null;
  }
}
