import type { Locale, OrderStatus, PaymentMethod, PaymentStatus } from '../types/domain';

export interface Messages {
  brand: {
    name: string;
    slogan: string;
    supportingText: string;
    logoMissing: string;
    imageSlot: string;
    ownerInputRequired: string;
  };
  nav: {
    home: string;
    shop: string;
    collection: string;
    about: string;
    contact: string;
    search: string;
    account: string;
    wishlist: string;
    bag: string;
    trackOrder: string;
    admin: string;
    menu: string;
    close: string;
    switchLanguage: string;
  };
  hero: {
    kicker: string;
    headline: string;
    subheadline: string;
    primaryCta: string;
    secondaryCta: string;
    videoFallbackNote: string;
  };
  statement: {
    eyebrow: string;
    headline: string;
    body: string;
  };
  collectionSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    viewAll: string;
    emptyTitle: string;
    emptyBody: string;
    emptyAdminHint: string;
  };
  aboutSection: {
    eyebrow: string;
    headline: string;
    body: string;
    cta: string;
  };
  campaignSection: {
    eyebrow: string;
    headline: string;
    subheadline: string;
    cta: string;
  };
  newsletter: {
    eyebrow: string;
    headline: string;
    description: string;
    emailPlaceholder: string;
    submit: string;
    submitting: string;
    success: string;
    alreadySubscribed: string;
    invalidEmail: string;
    error: string;
  };
  footer: {
    navigationTitle: string;
    policiesTitle: string;
    clientCareTitle: string;
    shippingReturns: string;
    privacy: string;
    terms: string;
    trackOrder: string;
    contact: string;
    currencyLabel: string;
    copyright: string;
  };
  pages: {
    aboutTitle: string;
    aboutDefaultBody: string;
    contactTitle: string;
    contactSubtitle: string;
    shippingTitle: string;
    privacyTitle: string;
    termsTitle: string;
    ownerInputNotice: string;
    shopPhaseTitle: string;
    shopPhaseBody: string;
    wishlistTitle: string;
    wishlistEmpty: string;
    accountTitle: string;
    cartTitle: string;
    cartEmpty: string;
    checkoutTitle: string;
    trackOrderTitle: string;
    adminTitle: string;
  };
  shop: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allCollections: string;
    allSubcategories: string;
    allApparelTypes: string;
    allColors: string;
    allSizes: string;
    inStockOnly: string;
    offersOnly: string;
    sortLabel: string;
    sortNewest: string;
    sortBestSelling: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    clearFilters: string;
    resultsCount: string;
    noProducts: string;
    quickView: string;
    addToCart: string;
    buyNow: string;
    askWhatsapp: string;
    selectSize: string;
    selectColor: string;
    quantity: string;
    sizeGuide: string;
    specifications: string;
    shippingInfo: string;
    returnPolicy: string;
    relatedProducts: string;
    available: string;
    lowStock: string;
    outOfStock: string;
    paused: string;
    unavailable: string;
    stockAvailableCount: string;
    addedToBag: string;
    viewBag: string;
    maxPrice: string;
    reviewsTitle: string;
    writeReview: string;
    noReviews: string;
    submitReview: string;
    reviewCommentPlaceholder: string;
    ratingLabel: string;
    reviewSubmitted: string;
    latestDrops: string;
    bestSelling: string;
    featuredPieces: string;
    offersDiscounts: string;
    allCategoriesTitle: string;
  };
  cart: {
    title: string;
    empty: string;
    subtotal: string;
    discount: string;
    shippingEstimate: string;
    shippingAtCheckout: string;
    total: string;
    couponPlaceholder: string;
    applyCoupon: string;
    couponInvalid: string;
    couponApplied: string;
    remove: string;
    proceedCheckout: string;
    continueShopping: string;
  };
  checkout: {
    title: string;
    contactInfo: string;
    shippingAddress: string;
    paymentMethod: string;
    orderSummary: string;
    fullName: string;
    email: string;
    phone: string;
    country: string;
    governorate: string;
    selectGovernorate: string;
    city: string;
    area: string;
    street: string;
    building: string;
    floor: string;
    apartment: string;
    landmark: string;
    deliveryNotes: string;
    cod: string;
    codDesc: string;
    instapay: string;
    instapayDesc: string;
    instapayReceipt: string;
    uploadReceipt: string;
    receiptUploaded: string;
    paymob: string;
    paymobDisabled: string;
    acceptTerms: string;
    placeOrder: string;
    placingOrder: string;
    codFee: string;
    shippingFee: string;
    freeShipping: string;
    orderConfirmed: string;
    orderNumberLabel: string;
    trackNow: string;
    validationError: string;
  };
  tracking: {
    title: string;
    subtitle: string;
    orderNumber: string;
    phone: string;
    submit: string;
    searching: string;
    notFound: string;
    statusLabel: string;
    paymentLabel: string;
    totalLabel: string;
    itemsCount: string;
    trackingCode: string;
    timelineTitle: string;
  };
  account: {
    overview: string;
    orders: string;
    wishlist: string;
    addresses: string;
    profile: string;
    preferences: string;
    noOrders: string;
    noAddresses: string;
    addAddress: string;
    addressLabel: string;
    saveProfile: string;
    saved: string;
    preferredLanguage: string;
    delete: string;
  };
  admin: {
    title: string;
    unauthorizedTitle: string;
    unauthorizedBody: string;
    backToStore: string;
    viewStorefront: string;
    notifications: string;
    noNotifications: string;
    quickAddProduct: string;
    tabs: {
      dashboard: string;
      products: string;
      'add-product': string;
      categories: string;
      inventory: string;
      orders: string;
      customers: string;
      discounts: string;
      reviews: string;
      analytics: string;
      settings: string;
      content: string;
      social: string;
      'my-account': string;
      logout: string;
    };
    metrics: {
      totalSales: string;
      totalOrders: string;
      totalProducts: string;
      totalCustomers: string;
      pendingOrders: string;
      completedOrders: string;
      availableVariants: string;
      lowStockVariants: string;
      outOfStockVariants: string;
      recentOrders: string;
      salesByStatus: string;
      inventoryAlerts: string;
      topSellingProducts: string;
      salesAnalytics: string;
      noDataYet: string;
    };
    analytics: {
      daily: string;
      weekly: string;
      monthly: string;
      yearly: string;
      revenue: string;
      ordersCount: string;
      averageOrderValue: string;
      exportCsv: string;
      unitsSold: string;
      paymentBreakdown: string;
    };
    myAccount: {
      profileTitle: string;
      profilePhoto: string;
      changePhoto: string;
      securityTitle: string;
      changePassword: string;
      currentPassword: string;
      newPassword: string;
      confirmNewPassword: string;
      updatePassword: string;
      passwordUpdated: string;
      recentActivity: string;
      noActivityYet: string;
      ownerRoleLabel: string;
      emailVerified: string;
    };
    actions: {
      add: string;
      edit: string;
      delete: string;
      save: string;
      saving: string;
      cancel: string;
      uploadImage: string;
      uploading: string;
      publish: string;
      unpublish: string;
      draft: string;
      confirmDelete: string;
      searchPlaceholder: string;
      prevPage: string;
      nextPage: string;
      viewDetails: string;
    };
  };
  contactForm: {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    submit: string;
    sending: string;
    success: string;
    error: string;
    validation: {
      nameRequired: string;
      emailInvalid: string;
      phoneInvalid: string;
      subjectRequired: string;
      messageRequired: string;
    };
  };
  auth: {
    signIn: string;
    createAccount: string;
    signOut: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    displayName: string;
    googleSignIn: string;
    forgotPassword: string;
    resetSent: string;
    verifyEmailNotice: string;
    resendVerification: string;
    verificationSent: string;
    signedInAs: string;
    emailRequired: string;
    phoneRequired: string;
    passwordMin: string;
    passwordsMismatch: string;
    nameRequired: string;
    authError: string;
    accountGateTitle: string;
    accountGateBody: string;
  };
  errors: {
    notFoundCode: string;
    notFoundTitle: string;
    notFoundBody: string;
    backHome: string;
    serverErrorCode: string;
    serverErrorTitle: string;
    serverErrorBody: string;
    retry: string;
  };
  badges: {
    new: string;
    available: string;
    lowStock: string;
    soldOut: string;
    paused: string;
    unavailable: string;
    sale: string;
    featured: string;
    bestSeller: string;
  };
  orderStatuses: Record<OrderStatus, string>;
  paymentMethods: Record<PaymentMethod, string>;
  paymentStatuses: Record<PaymentStatus, string>;
}

export const MESSAGES: Record<Locale, Messages> = {
  en: {
    brand: {
      name: 'FAVMO',
      slogan: 'CREATE BEYOND LIMITS.',
      supportingText: 'Designed for those who refuse to follow ordinary limits.',
      logoMissing: 'LOGO ASSET REQUIRED',
      imageSlot: 'Image Slot',
      ownerInputRequired: 'OWNER INPUT REQUIRED',
    },
    nav: {
      home: 'HOME',
      shop: 'SHOP',
      collection: 'COLLECTION',
      about: 'ABOUT',
      contact: 'CONTACT',
      search: 'Search',
      account: 'Account',
      wishlist: 'Wishlist',
      bag: 'Bag',
      trackOrder: 'Track Order',
      admin: 'Admin',
      menu: 'Menu',
      close: 'Close',
      switchLanguage: 'العربية',
    },
    hero: {
      kicker: 'FAVMO',
      headline: 'CREATE BEYOND LIMITS.',
      subheadline: 'Designed for those who refuse to follow ordinary limits.',
      primaryCta: 'SHOP COLLECTION',
      secondaryCta: 'EXPLORE FAVMO',
      videoFallbackNote: 'Image Slot — Hero Media',
    },
    statement: {
      eyebrow: 'IDENTITY',
      headline: 'ENGINEERED FOR PRESENCE.',
      body: 'Every garment begins with architectural proportion, disciplined monochrome contrast, and uncompromising construction.',
    },
    collectionSection: {
      eyebrow: 'FIRST RELEASE',
      title: 'THE HOODIE COLLECTION',
      subtitle: 'A new standard of everyday streetwear.',
      viewAll: 'SHOP COLLECTION',
      emptyTitle: 'NO PUBLISHED PRODUCTS YET',
      emptyBody: 'The Hoodie Collection is ready for owner catalog entries and original photography.',
      emptyAdminHint: 'Catalog items appear once published in the Admin Dashboard with verified pricing and inventory.',
    },
    aboutSection: {
      eyebrow: 'MANIFESTO',
      headline: 'MORE THAN CLOTHING. A STATEMENT.',
      body: 'FAVMO strips streetwear back to pure form—black, white, weight, and precision stitching—built for individuals who define their own standard.',
      cta: 'EXPLORE FAVMO',
    },
    campaignSection: {
      eyebrow: 'CAMPAIGN',
      headline: 'BUILT WITHOUT COMPROMISE.',
      subheadline: 'Monochrome essentials shaped for daily permanence.',
      cta: 'VIEW COLLECTION',
    },
    newsletter: {
      eyebrow: 'DISPATCH',
      headline: 'JOIN THE FAVMO LIST.',
      description: 'Receive release announcements and private access updates when new drops arrive.',
      emailPlaceholder: 'Enter your email address',
      submit: 'SUBSCRIBE',
      submitting: 'SAVING...',
      success: 'Your email has been registered for FAVMO dispatches.',
      alreadySubscribed: 'This email is already subscribed to FAVMO dispatches.',
      invalidEmail: 'Please enter a valid email address.',
      error: 'Unable to subscribe right now. Please try again.',
    },
    footer: {
      navigationTitle: 'NAVIGATION',
      policiesTitle: 'POLICIES',
      clientCareTitle: 'CLIENT CARE',
      shippingReturns: 'Shipping & Returns',
      privacy: 'Privacy Policy',
      terms: 'Terms & Conditions',
      trackOrder: 'Track Order',
      contact: 'Contact Us',
      currencyLabel: 'Currency: EGP',
      copyright: '© 2026 FAVMO. All rights reserved.',
    },
    pages: {
      aboutTitle: 'MORE THAN CLOTHING. A STATEMENT.',
      aboutDefaultBody:
        'FAVMO is an independent streetwear house focused on architectural silhouettes, pure monochrome restraint, and tactile craft.',
      contactTitle: 'CONTACT FAVMO',
      contactSubtitle: 'Reach our team for order inquiries, sizing assistance, or brand communications.',
      shippingTitle: 'SHIPPING & RETURNS',
      privacyTitle: 'PRIVACY POLICY',
      termsTitle: 'TERMS & CONDITIONS',
      ownerInputNotice:
        'Approved legal and operational policy text has not yet been published by the brand owner.',
      shopPhaseTitle: 'SHOP',
      shopPhaseBody: 'Browse published garments.',
      wishlistTitle: 'WISHLIST',
      wishlistEmpty: 'Your saved wishlist is currently empty.',
      accountTitle: 'ACCOUNT',
      cartTitle: 'SHOPPING BAG',
      cartEmpty: 'Your shopping bag is currently empty.',
      checkoutTitle: 'CHECKOUT',
      trackOrderTitle: 'TRACK ORDER',
      adminTitle: 'ADMIN DASHBOARD',
    },
    shop: {
      title: 'SHOP',
      subtitle: 'Monochrome streetwear crafted for permanence.',
      searchPlaceholder: 'Search garments...',
      allCollections: 'All Categories',
      allSubcategories: 'All Subcategories',
      allApparelTypes: 'All Apparel Types',
      allColors: 'All Colors',
      allSizes: 'All Sizes',
      inStockOnly: 'In stock only',
      offersOnly: 'Offers & Discounts',
      sortLabel: 'Sort',
      sortNewest: 'Newest',
      sortBestSelling: 'Best Selling',
      sortPriceAsc: 'Price: Low to High',
      sortPriceDesc: 'Price: High to Low',
      clearFilters: 'Clear Filters',
      resultsCount: 'results',
      noProducts: 'No matching products found.',
      quickView: 'Quick View',
      addToCart: 'ADD TO BAG',
      buyNow: 'BUY NOW',
      askWhatsapp: 'INQUIRE ON WHATSAPP',
      selectSize: 'Select Size',
      selectColor: 'Select Color',
      quantity: 'Quantity',
      sizeGuide: 'Size Guide',
      specifications: 'Specifications',
      shippingInfo: 'Shipping Information',
      returnPolicy: 'Return Policy',
      relatedProducts: 'RELATED PIECES',
      available: 'Available',
      lowStock: 'Low Stock',
      outOfStock: 'Out of Stock',
      paused: 'Sales Paused',
      unavailable: 'Currently Unavailable',
      stockAvailableCount: 'in stock',
      addedToBag: 'Added to bag',
      viewBag: 'View Bag',
      maxPrice: 'Max Price (EGP)',
      reviewsTitle: 'CUSTOMER REVIEWS',
      writeReview: 'Write a Review',
      noReviews: 'No customer reviews for this piece yet.',
      submitReview: 'SUBMIT REVIEW',
      reviewCommentPlaceholder: 'Share fit, fabric weight, and craftsmanship feedback...',
      ratingLabel: 'Rating',
      reviewSubmitted: 'Review published.',
      latestDrops: 'LATEST DROPS',
      bestSelling: 'BEST SELLING',
      featuredPieces: 'FEATURED',
      offersDiscounts: 'OFFERS & DISCOUNTS',
      allCategoriesTitle: 'CATEGORIES',
    },
    cart: {
      title: 'SHOPPING BAG',
      empty: 'Your shopping bag is currently empty.',
      subtotal: 'Subtotal',
      discount: 'Discount',
      shippingEstimate: 'Shipping',
      shippingAtCheckout: 'Calculated at checkout',
      total: 'Total',
      couponPlaceholder: 'Promo code',
      applyCoupon: 'APPLY',
      couponInvalid: 'Discount code is invalid or expired.',
      couponApplied: 'Discount applied',
      remove: 'Remove',
      proceedCheckout: 'PROCEED TO CHECKOUT',
      continueShopping: 'CONTINUE SHOPPING',
    },
    checkout: {
      title: 'CHECKOUT',
      contactInfo: 'Contact Details',
      shippingAddress: 'Delivery Address',
      paymentMethod: 'Payment Method',
      orderSummary: 'Order Summary',
      fullName: 'Full Name',
      email: 'Email Address',
      phone: 'Phone Number',
      country: 'Country',
      governorate: 'Governorate',
      selectGovernorate: 'Select Governorate',
      city: 'City',
      area: 'Area / District',
      street: 'Street',
      building: 'Building',
      floor: 'Floor (Optional)',
      apartment: 'Apartment (Optional)',
      landmark: 'Landmark (Optional)',
      deliveryNotes: 'Delivery Notes (Optional)',
      cod: 'Cash on Delivery (COD)',
      codDesc: 'Pay cash upon delivery.',
      instapay: 'InstaPay / Bank Transfer',
      instapayDesc: 'Upload transfer receipt; payment stays pending until admin verification.',
      instapayReceipt: 'Transfer Receipt',
      uploadReceipt: 'Upload Receipt Image',
      receiptUploaded: 'Receipt uploaded',
      paymob: 'Paymob Card / Wallet',
      paymobDisabled: 'Paymob is currently disabled until merchant credentials are configured.',
      acceptTerms: 'I accept the terms and conditions.',
      placeOrder: 'PLACE ORDER',
      placingOrder: 'PROCESSING ORDER...',
      codFee: 'COD Fee',
      shippingFee: 'Shipping',
      freeShipping: 'Free',
      orderConfirmed: 'ORDER CONFIRMED',
      orderNumberLabel: 'Order Number',
      trackNow: 'TRACK ORDER',
      validationError: 'Please review the highlighted fields.',
    },
    tracking: {
      title: 'TRACK ORDER',
      subtitle: 'Enter your order number and phone number to inspect live fulfillment progress.',
      orderNumber: 'Order Number (e.g. FAV-2026-000001)',
      phone: 'Phone Number',
      submit: 'TRACK',
      searching: 'CHECKING...',
      notFound: 'No matching order was found for this order number and phone.',
      statusLabel: 'Order Status',
      paymentLabel: 'Payment Status',
      totalLabel: 'Order Total',
      itemsCount: 'Items',
      trackingCode: 'Tracking Reference',
      timelineTitle: 'Status Timeline',
    },
    account: {
      overview: 'Overview',
      orders: 'Orders',
      wishlist: 'Wishlist',
      addresses: 'Addresses',
      profile: 'Personal Info',
      preferences: 'Language',
      noOrders: 'You have not placed any orders yet.',
      noAddresses: 'No saved delivery addresses yet.',
      addAddress: 'Save Address',
      addressLabel: 'Address Label (e.g. Home, Work)',
      saveProfile: 'Save Changes',
      saved: 'Saved.',
      preferredLanguage: 'Preferred Language',
      delete: 'Delete',
    },
    admin: {
      title: 'FAVMO ADMIN',
      unauthorizedTitle: 'ACCESS RESTRICTED',
      unauthorizedBody: 'Administration is strictly restricted to the verified Store Owner account.',
      backToStore: 'RETURN TO STORE',
      viewStorefront: 'View Store',
      notifications: 'Notifications',
      noNotifications: 'All systems clear — no pending alerts.',
      quickAddProduct: 'Add New Product',
      tabs: {
        dashboard: 'Dashboard',
        products: 'Products',
        'add-product': 'Add New Product',
        categories: 'Categories',
        inventory: 'Inventory',
        orders: 'Orders',
        customers: 'Customers',
        discounts: 'Discounts & Coupons',
        reviews: 'Reviews',
        analytics: 'Analytics & Reports',
        settings: 'Store Settings',
        content: 'Website Content',
        social: 'Contact & Social Media',
        'my-account': 'My Account',
        logout: 'Logout',
      },
      metrics: {
        totalSales: 'Total Revenue',
        totalOrders: 'Total Orders',
        totalProducts: 'Total Products',
        totalCustomers: 'Total Customers',
        pendingOrders: 'Pending Orders',
        completedOrders: 'Completed Orders',
        availableVariants: 'In-Stock SKUs',
        lowStockVariants: 'Low Stock Products',
        outOfStockVariants: 'Out of Stock Products',
        recentOrders: 'Recent Orders',
        salesByStatus: 'Orders by Status',
        inventoryAlerts: 'Inventory Alerts',
        topSellingProducts: 'Top Selling Products',
        salesAnalytics: 'Sales Analytics',
        noDataYet: 'No real records exist yet.',
      },
      analytics: {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
        revenue: 'Revenue',
        ordersCount: 'Orders',
        averageOrderValue: 'Average Order Value',
        exportCsv: 'Export CSV',
        unitsSold: 'Units Sold',
        paymentBreakdown: 'Revenue by Payment Method',
      },
      myAccount: {
        profileTitle: 'Admin Profile',
        profilePhoto: 'Profile Photo',
        changePhoto: 'Upload Photo',
        securityTitle: 'Security & Verification',
        changePassword: 'Change Password',
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmNewPassword: 'Confirm New Password',
        updatePassword: 'Update Password',
        passwordUpdated: 'Password updated successfully.',
        recentActivity: 'Recent Account Activity',
        noActivityYet: 'No admin audit events recorded yet.',
        ownerRoleLabel: 'Store Owner (Single Verified Admin)',
        emailVerified: 'Verified Email',
      },
      actions: {
        add: 'Add New',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        saving: 'Saving...',
        cancel: 'Cancel',
        uploadImage: 'Upload Image',
        uploading: 'Uploading...',
        publish: 'Publish',
        unpublish: 'Unpublish',
        draft: 'Draft',
        confirmDelete: 'Confirm Delete?',
        searchPlaceholder: 'Search...',
        prevPage: 'Previous',
        nextPage: 'Next',
        viewDetails: 'View Details',
      },
    },
    contactForm: {
      name: 'Full Name',
      email: 'Email Address',
      phone: 'Phone Number (Optional)',
      subject: 'Subject',
      message: 'Message',
      submit: 'SEND MESSAGE',
      sending: 'SENDING...',
      success: 'Your message has been received. Our team will respond via email.',
      error: 'Unable to submit your message right now. Please try again.',
      validation: {
        nameRequired: 'Please enter your full name.',
        emailInvalid: 'Please enter a valid email address.',
        phoneInvalid: 'Please enter a valid phone number.',
        subjectRequired: 'Please enter a subject.',
        messageRequired: 'Please enter your message (at least 10 characters).',
      },
    },
    auth: {
      signIn: 'SIGN IN',
      createAccount: 'CREATE ACCOUNT',
      signOut: 'SIGN OUT',
      email: 'Email Address',
      phone: 'Phone Number',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      displayName: 'Full Name',
      googleSignIn: 'Continue with Google',
      forgotPassword: 'Forgot password?',
      resetSent: 'Password reset instructions sent if the account exists.',
      verifyEmailNotice: 'Please verify your email address via the link sent to your inbox.',
      resendVerification: 'Resend verification email',
      verificationSent: 'Verification email sent.',
      signedInAs: 'Signed in as',
      emailRequired: 'Valid email is required.',
      phoneRequired: 'Valid phone number is required.',
      passwordMin: 'Password must be at least 8 characters.',
      passwordsMismatch: 'Passwords do not match.',
      nameRequired: 'Name is required.',
      authError: 'Authentication failed. Check your credentials and try again.',
      accountGateTitle: 'CUSTOMER ACCOUNT REQUIRED',
      accountGateBody: 'Sign in or create a FAVMO customer account to enter the store, manage your bag, and place orders.',
    },
    errors: {
      notFoundCode: '404',
      notFoundTitle: 'PAGE NOT FOUND',
      notFoundBody: 'The page you requested could not be located in the FAVMO storefront.',
      backHome: 'RETURN HOME',
      serverErrorCode: '500',
      serverErrorTitle: 'UNEXPECTED ERROR',
      serverErrorBody: 'Something interrupted this view. Please reload to continue.',
      retry: 'RELOAD VIEW',
    },
    badges: {
      new: 'NEW',
      available: 'AVAILABLE',
      lowStock: 'LOW STOCK',
      soldOut: 'OUT OF STOCK',
      paused: 'PAUSED',
      unavailable: 'UNAVAILABLE',
      sale: 'SALE',
      featured: 'FEATURED',
      bestSeller: 'BEST SELLER',
    },
    orderStatuses: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      returned: 'Returned',
      refunded: 'Refunded',
    },
    paymentMethods: {
      cod: 'Cash on Delivery',
      instapay: 'InstaPay / Transfer',
      paymob: 'Paymob',
    },
    paymentStatuses: {
      pending: 'Pending',
      awaiting_verification: 'Awaiting Verification',
      paid: 'Paid',
      failed: 'Failed',
      rejected: 'Rejected',
      refunded: 'Refunded',
    },
  },
  ar: {
    brand: {
      name: 'FAVMO',
      slogan: 'ابدع بلا حدود.',
      supportingText: 'صُمّم لمن يرفضون السير داخل الحدود المعتادة.',
      logoMissing: 'LOGO ASSET REQUIRED',
      imageSlot: 'Image Slot',
      ownerInputRequired: 'OWNER INPUT REQUIRED',
    },
    nav: {
      home: 'الرئيسية',
      shop: 'المتجر',
      collection: 'المجموعات',
      about: 'من نحن',
      contact: 'تواصل معنا',
      search: 'بحث',
      account: 'الحساب',
      wishlist: 'المفضلة',
      bag: 'الحقيبة',
      trackOrder: 'تتبع الطلب',
      admin: 'لوحة الإدارة',
      menu: 'القائمة',
      close: 'إغلاق',
      switchLanguage: 'English',
    },
    hero: {
      kicker: 'FAVMO',
      headline: 'ابدع بلا حدود.',
      subheadline: 'صُمّم لمن يرفضون السير داخل الحدود المعتادة.',
      primaryCta: 'تسوّق المجموعة',
      secondaryCta: 'اكتشف FAVMO',
      videoFallbackNote: 'Image Slot — وسائط الواجهة الرئيسية',
    },
    statement: {
      eyebrow: 'الهوية',
      headline: 'حضورٌ يتجاوز المألوف.',
      body: 'تبدأ كل قطعة بتناسبٍ هندسي دقيق، وتباينٍ أحاديّ صريح بين الأسود والأبيض، وجودة تنفيذ لا تقبل المساومة.',
    },
    collectionSection: {
      eyebrow: 'الإصدار الأول',
      title: 'مجموعة الهوديز',
      subtitle: 'معيار جديد لملابس الشارع اليومية.',
      viewAll: 'تسوّق المجموعة',
      emptyTitle: 'لا توجد منتجات منشورة بعد',
      emptyBody: 'المتجر جاهز لإضافة المنتجات والصور الأصلية من لوحة تحكم الإدارة.',
      emptyAdminHint: 'تظهر المنتجات هنا مباشرة فور إضافتها ونشرها من لوحة الإدارة.',
    },
    aboutSection: {
      eyebrow: 'البيان',
      headline: 'أكثر من مجرد ملابس. موقف.',
      body: 'تعيد FAVMO تعريف ملابس الشارع عبر خطوط نقية وخامات مدروسة وحضور بصري حاسم يعبّر عن أسلوب لا يتبع القواعد المعتادة.',
      cta: 'اكتشف FAVMO',
    },
    campaignSection: {
      eyebrow: 'الحملة',
      headline: 'تصميم بلا تنازلات.',
      subheadline: 'أساسيات أحادية اللون صُمّمت لتدوم.',
      cta: 'استعرض المجموعة',
    },
    newsletter: {
      eyebrow: 'النشرة البريدية',
      headline: 'انضم إلى قائمة FAVMO.',
      description: 'احصل على إشعارات الإصدارات الجديدة والتحديثات الحصرية فور توفرها.',
      emailPlaceholder: 'أدخل بريدك الإلكتروني',
      submit: 'اشترك',
      submitting: 'جارٍ الحفظ...',
      success: 'تم تسجيل بريدك الإلكتروني في نشرة FAVMO بنجاح.',
      alreadySubscribed: 'هذا البريد الإلكتروني مسجّل بالفعل في نشرة FAVMO.',
      invalidEmail: 'يرجى إدخال بريد إلكتروني صحيح.',
      error: 'تعذّر إتمام الاشتراك حالياً. يرجى المحاولة مرة أخرى.',
    },
    footer: {
      navigationTitle: 'التصفح',
      policiesTitle: 'السياسات',
      clientCareTitle: 'خدمة العملاء',
      shippingReturns: 'الشحن والاسترجاع',
      privacy: 'سياسة الخصوصية',
      terms: 'الشروط والأحكام',
      trackOrder: 'تتبع الطلب',
      contact: 'تواصل معنا',
      currencyLabel: 'العملة: ج.م',
      copyright: '© 2026 FAVMO. جميع الحقوق محفوظة.',
    },
    pages: {
      aboutTitle: 'أكثر من مجرد ملابس. موقف.',
      aboutDefaultBody:
        'FAVMO علامة ملابس شارع مستقلة تركز على القصّات الهندسية، والانضباط اللوني الأحادي، ودقة التنفيذ.',
      contactTitle: 'تواصل مع FAVMO',
      contactSubtitle: 'تواصل مع فريقنا لاستفسارات الطلبات أو المقاسات أو التواصل الرسمي.',
      shippingTitle: 'الشحن والاسترجاع',
      privacyTitle: 'سياسة الخصوصية',
      termsTitle: 'الشروط والأحكام',
      ownerInputNotice: 'لم ينشر مالك العلامة التجارية النص القانوني أو التشغيلي المعتمد لهذه الصفحة بعد.',
      shopPhaseTitle: 'المتجر',
      shopPhaseBody: 'تصفح القطع المتاحة.',
      wishlistTitle: 'المفضلة',
      wishlistEmpty: 'قائمة المفضلة فارغة حالياً.',
      accountTitle: 'الحساب',
      cartTitle: 'حقيبة التسوق',
      cartEmpty: 'حقيبة التسوق فارغة حالياً.',
      checkoutTitle: 'إتمام الطلب',
      trackOrderTitle: 'تتبع الطلب',
      adminTitle: 'لوحة تحكم الإدارة',
    },
    shop: {
      title: 'المتجر',
      subtitle: 'ملابس شارع أحادية اللون صُمّمت لتدوم.',
      searchPlaceholder: 'ابحث عن الملابس...',
      allCollections: 'جميع التصنيفات',
      allSubcategories: 'جميع التصنيفات الفرعية',
      allApparelTypes: 'جميع أنواع الملابس',
      allColors: 'جميع الألوان',
      allSizes: 'جميع المقاسات',
      inStockOnly: 'المتوفر فقط',
      offersOnly: 'العروض والخصومات',
      sortLabel: 'ترتيب',
      sortNewest: 'الأحدث',
      sortBestSelling: 'الأكثر مبيعاً',
      sortPriceAsc: 'السعر: من الأقل للأعلى',
      sortPriceDesc: 'السعر: من الأعلى للأقل',
      clearFilters: 'مسح الفلاتر',
      resultsCount: 'منتج',
      noProducts: 'لا توجد منتجات مطابقة لخيارات البحث الحالية.',
      quickView: 'معاينة سريعة',
      addToCart: 'إضافة إلى السلة',
      buyNow: 'اشترِ الآن',
      askWhatsapp: 'استفسر عبر واتساب',
      selectSize: 'اختر المقاس',
      selectColor: 'اختر اللون',
      quantity: 'الكمية',
      sizeGuide: 'دليل المقاسات',
      specifications: 'المواصفات',
      shippingInfo: 'معلومات الشحن',
      returnPolicy: 'سياسة الاسترجاع',
      relatedProducts: 'قطع ذات صلة',
      available: 'متاح',
      lowStock: 'كمية قليلة',
      outOfStock: 'نفد المخزون',
      paused: 'متوقف مؤقتاً',
      unavailable: 'غير متاح حالياً',
      stockAvailableCount: 'قطعة متاحة',
      addedToBag: 'تمت الإضافة إلى السلة',
      viewBag: 'عرض السلة',
      maxPrice: 'الحد الأقصى للسعر (ج.م)',
      reviewsTitle: 'تقييمات العملاء',
      writeReview: 'أضف تقييمك',
      noReviews: 'لا توجد تقييمات لهذه القطعة بعد.',
      submitReview: 'إرسال التقييم',
      reviewCommentPlaceholder: 'شارك رأيك في الخامة والمقاس وجودة التفصيل...',
      ratingLabel: 'التقييم',
      reviewSubmitted: 'تم نشر التقييم.',
      latestDrops: 'أحدث المنتجات',
      bestSelling: 'الأكثر مبيعاً',
      featuredPieces: 'المنتجات المميزة',
      offersDiscounts: 'العروض والخصومات',
      allCategoriesTitle: 'التصنيفات',
    },
    cart: {
      title: 'حقيبة التسوق',
      empty: 'حقيبة التسوق فارغة حالياً.',
      subtotal: 'المجموع الفرعي',
      discount: 'الخصم',
      shippingEstimate: 'الشحن',
      shippingAtCheckout: 'يُحسب عند إتمام الطلب',
      total: 'الإجمالي',
      couponPlaceholder: 'كود الخصم',
      applyCoupon: 'تطبيق',
      couponInvalid: 'كود الخصم غير صالح أو منتهي الصلاحية.',
      couponApplied: 'تم تطبيق الخصم',
      remove: 'حذف',
      proceedCheckout: 'إتمام الطلب',
      continueShopping: 'متابعة التسوق',
    },
    checkout: {
      title: 'إتمام الطلب',
      contactInfo: 'بيانات التواصل',
      shippingAddress: 'عنوان التوصيل',
      paymentMethod: 'طريقة الدفع',
      orderSummary: 'ملخص الطلب',
      fullName: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      country: 'الدولة',
      governorate: 'المحافظة',
      selectGovernorate: 'اختر المحافظة',
      city: 'المدينة',
      area: 'المنطقة / الحي',
      street: 'الشارع',
      building: 'رقم المبنى',
      floor: 'الدور (اختياري)',
      apartment: 'الشقة (اختياري)',
      landmark: 'علامة مميزة (اختياري)',
      deliveryNotes: 'ملاحظات التوصيل (اختياري)',
      cod: 'الدفع عند الاستلام (COD)',
      codDesc: 'ادفع نقداً عند استلام الطلب.',
      instapay: 'InstaPay / تحويل بنكي',
      instapayDesc: 'ارفع صورة إيصال التحويل، ويبقى الدفع قيد المراجعة حتى اعتماد الإدارة.',
      instapayReceipt: 'إيصال التحويل',
      uploadReceipt: 'رفع صورة الإيصال',
      receiptUploaded: 'تم رفع الإيصال',
      paymob: 'Paymob بطاقة / محفظة',
      paymobDisabled: 'بوابة Paymob معطلة حالياً حتى يتم إدخال بيانات التاجر.',
      acceptTerms: 'أوافق على الشروط والأحكام.',
      placeOrder: 'تأكيد الطلب',
      placingOrder: 'جارٍ تسجيل الطلب...',
      codFee: 'رسوم الدفع عند الاستلام',
      shippingFee: 'رسوم الشحن',
      freeShipping: 'مجاني',
      orderConfirmed: 'تم تسجيل طلبك بنجاح',
      orderNumberLabel: 'رقم الطلب',
      trackNow: 'تتبع الطلب الآن',
      validationError: 'يرجى مراجعة الحقول المطلوبة.',
    },
    tracking: {
      title: 'تتبع الطلب',
      subtitle: 'أدخل رقم الطلب ورقم الهاتف لمتابعة حالة تجهيز وشحن طلبك.',
      orderNumber: 'رقم الطلب (مثال: FAV-2026-000001)',
      phone: 'رقم الهاتف',
      submit: 'تتبع',
      searching: 'جارٍ البحث...',
      notFound: 'لم يتم العثور على طلب مطابق لرقم الطلب والهاتف.',
      statusLabel: 'حالة الطلب',
      paymentLabel: 'حالة الدفع',
      totalLabel: 'إجمالي الطلب',
      itemsCount: 'عدد القطع',
      trackingCode: 'رقم التتبع',
      timelineTitle: 'سجل حالات الطلب',
    },
    account: {
      overview: 'نظرة عامة',
      orders: 'طلباتي',
      wishlist: 'المفضلة',
      addresses: 'العناوين',
      profile: 'البيانات الشخصية',
      preferences: 'اللغة',
      noOrders: 'لم تقم بأي طلبات بعد.',
      noAddresses: 'لا توجد عناوين توصيل محفوظة.',
      addAddress: 'حفظ العنوان',
      addressLabel: 'تسمية العنوان (مثال: المنزل، العمل)',
      saveProfile: 'حفظ التعديلات',
      saved: 'تم الحفظ.',
      preferredLanguage: 'اللغة المفضلة',
      delete: 'حذف',
    },
    admin: {
      title: 'لوحة تحكم FAVMO',
      unauthorizedTitle: 'صلاحية مقيدة',
      unauthorizedBody: 'الوصول إلى لوحة الإدارة مقتصر حصرياً على حساب مالك المتجر الموثق.',
      backToStore: 'العودة إلى المتجر',
      viewStorefront: 'عرض المتجر',
      notifications: 'التنبيهات',
      noNotifications: 'لا توجد تنبيهات معلّقة حالياً.',
      quickAddProduct: 'إضافة منتج جديد',
      tabs: {
        dashboard: 'لوحة التحكم',
        products: 'المنتجات',
        'add-product': 'إضافة منتج جديد',
        categories: 'التصنيفات',
        inventory: 'المخزون',
        orders: 'الطلبات',
        customers: 'العملاء',
        discounts: 'الخصومات والكوبونات',
        reviews: 'التقييمات',
        analytics: 'التحليلات والتقارير',
        settings: 'إعدادات المتجر',
        content: 'محتوى الموقع',
        social: 'التواصل والسوشيال ميديا',
        'my-account': 'حسابي',
        logout: 'تسجيل الخروج',
      },
      metrics: {
        totalSales: 'إجمالي الإيرادات',
        totalOrders: 'إجمالي الطلبات',
        totalProducts: 'إجمالي المنتجات',
        totalCustomers: 'إجمالي العملاء',
        pendingOrders: 'طلبات قيد الانتظار',
        completedOrders: 'طلبات مكتملة',
        availableVariants: 'متوفر في المخزون',
        lowStockVariants: 'منتجات منخفضة المخزون',
        outOfStockVariants: 'منتجات نافدة',
        recentOrders: 'أحدث الطلبات',
        salesByStatus: 'حالات الطلبات',
        inventoryAlerts: 'تنبيهات المخزون',
        topSellingProducts: 'المنتجات الأكثر مبيعاً',
        salesAnalytics: 'تحليلات المبيعات',
        noDataYet: 'لا توجد بيانات فعلية بعد.',
      },
      analytics: {
        daily: 'يومي',
        weekly: 'أسبوعي',
        monthly: 'شهري',
        yearly: 'سنوي',
        revenue: 'الإيرادات',
        ordersCount: 'الطلبات',
        averageOrderValue: 'متوسط قيمة الطلب',
        exportCsv: 'تصدير CSV',
        unitsSold: 'القطع المباعة',
        paymentBreakdown: 'الإيرادات حسب وسيلة الدفع',
      },
      myAccount: {
        profileTitle: 'الملف الشخصي للمدير',
        profilePhoto: 'الصورة الشخصية',
        changePhoto: 'تغيير الصورة',
        securityTitle: 'الأمان والتحقق',
        changePassword: 'تغيير كلمة المرور',
        currentPassword: 'كلمة المرور الحالية',
        newPassword: 'كلمة المرور الجديدة',
        confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
        updatePassword: 'تحديث كلمة المرور',
        passwordUpdated: 'تم تحديث كلمة المرور بنجاح.',
        recentActivity: 'النشاط الأخير للحساب',
        noActivityYet: 'لا توجد سجلات نشاط إداري بعد.',
        ownerRoleLabel: 'مالك المتجر (مدير وحيد موثق)',
        emailVerified: 'بريد إلكتروني موثّق',
      },
      actions: {
        add: 'إضافة جديد',
        edit: 'تعديل',
        delete: 'حذف',
        save: 'حفظ',
        saving: 'جارٍ الحفظ...',
        cancel: 'إلغاء',
        uploadImage: 'رفع صورة',
        uploading: 'جارٍ الرفع...',
        publish: 'نشر',
        unpublish: 'إلغاء النشر',
        draft: 'مسودة',
        confirmDelete: 'تأكيد الحذف؟',
        searchPlaceholder: 'بحث...',
        prevPage: 'السابق',
        nextPage: 'التالي',
        viewDetails: 'عرض التفاصيل',
      },
    },
    contactForm: {
      name: 'الاسم الكامل',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف (اختياري)',
      subject: 'الموضوع',
      message: 'الرسالة',
      submit: 'إرسال الرسالة',
      sending: 'جارٍ الإرسال...',
      success: 'تم استلام رسالتك بنجاح. سيتواصل معك فريقنا عبر البريد الإلكتروني.',
      error: 'تعذّر إرسال الرسالة حالياً. يرجى المحاولة لاحقاً.',
      validation: {
        nameRequired: 'يرجى إدخال الاسم الكامل.',
        emailInvalid: 'يرجى إدخال بريد إلكتروني صحيح.',
        phoneInvalid: 'يرجى إدخال رقم هاتف صحيح.',
        subjectRequired: 'يرجى إدخال موضوع الرسالة.',
        messageRequired: 'يرجى كتابة رسالة لا تقل عن 10 أحرف.',
      },
    },
    auth: {
      signIn: 'تسجيل الدخول',
      createAccount: 'إنشاء حساب',
      signOut: 'تسجيل الخروج',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      displayName: 'الاسم الكامل',
      googleSignIn: 'المتابعة عبر Google',
      forgotPassword: 'نسيت كلمة المرور؟',
      resetSent: 'تم إرسال تعليمات إعادة تعيين كلمة المرور إذا كان الحساب موجوداً.',
      verifyEmailNotice: 'يرجى تأكيد بريدك الإلكتروني عبر الرابط المرسل لصندوق الوارد.',
      resendVerification: 'إعادة إرسال رابط التأكيد',
      verificationSent: 'تم إرسال رسالة التأكيد.',
      signedInAs: 'تم تسجيل الدخول باسم',
      emailRequired: 'يرجى إدخال بريد إلكتروني صحيح.',
      phoneRequired: 'يرجى إدخال رقم هاتف صحيح.',
      passwordMin: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
      passwordsMismatch: 'كلمتا المرور غير متطابقتين.',
      nameRequired: 'يرجى إدخال الاسم الكامل.',
      authError: 'تعذّر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.',
      accountGateTitle: 'يتطلب الدخول إنشاء حساب عميل',
      accountGateBody: 'سجّل الدخول أو أنشئ حساب عميل في FAVMO للدخول إلى المتجر وإدارة السلة وإتمام الطلبات.',
    },
    errors: {
      notFoundCode: '404',
      notFoundTitle: 'الصفحة غير موجودة',
      notFoundBody: 'تعذّر العثور على الصفحة المطلوبة في متجر FAVMO.',
      backHome: 'العودة للرئيسية',
      serverErrorCode: '500',
      serverErrorTitle: 'حدث خطأ غير متوقع',
      serverErrorBody: 'تعذّر عرض هذه الصفحة حالياً. يرجى إعادة التحميل للمتابعة.',
      retry: 'إعادة التحميل',
    },
    badges: {
      new: 'جديد',
      available: 'متاح',
      lowStock: 'كمية محدودة',
      soldOut: 'نفد المخزون',
      paused: 'متوقف مؤقتاً',
      unavailable: 'غير متاح حالياً',
      sale: 'خصم',
      featured: 'مميز',
      bestSeller: 'الأكثر مبيعاً',
    },
    orderStatuses: {
      pending: 'قيد الانتظار',
      confirmed: 'تم التأكيد',
      processing: 'قيد التجهيز',
      shipped: 'تم الشحن',
      out_for_delivery: 'خارج للتوصيل',
      delivered: 'تم التوصيل',
      cancelled: 'ملغي',
      returned: 'مرتجع',
      refunded: 'مسترد',
    },
    paymentMethods: {
      cod: 'الدفع عند الاستلام',
      instapay: 'InstaPay / تحويل بنكي',
      paymob: 'Paymob',
    },
    paymentStatuses: {
      pending: 'قيد الانتظار',
      awaiting_verification: 'بانتظار المراجعة',
      paid: 'مدفوع',
      failed: 'فشل',
      rejected: 'مرفوض',
      refunded: 'مسترد',
    },
  },
};
