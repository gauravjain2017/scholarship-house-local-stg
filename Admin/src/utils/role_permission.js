const rolePermissions = {
  admin_roles: [
    {
      permissions: [
        {
          module: "User Management",
          slug: "user_management",
          actions: [
            { label: "All User List", slug: "user_management.user_listing", radioGroup: "user_listing" },
            { label: "Own User List", slug: "user_management.own_user_listing", radioGroup: "user_listing" },
            { label: "Edit User", slug: "user_management.edit_user" },
            { label: "Approve User", slug: "user_management.approve_user" },
            { label: "Reject User", slug: "user_management.reject_user" },
            { label: "Reset Password", slug: "user_management.reset_password" },
            { label: "Delete User", slug: "user_management.delete_user" },
            { label: "Add New User", slug: "user_management.add_new_user" },
          ],
        },
        {
          module: "Property Management",
          slug: "property_management",
          actions: [
            { label: "View Property Listing", slug: "property_management.view_property_listing" },
            { label: "Manage/Edit Property", slug: "property_management.manage_edit_property" },
            { label: "Approve Property", slug: "property_management.approve_property" },
            { label: "Reject Property", slug: "property_management.reject_property" },
            { label: "Delete Property", slug: "property_management.delete_property" },
            { label: "Mark As Pending Property", slug: "property_management.mark_as_pending_property" },
            { label: "Published Property", slug: "property_management.published_property" },
            { label: "Mark As Sold Property", slug: "property_management.mark_as_sold_property" },
          ],
        },
        {
          module: "Submit Property",
          slug: "submit_property",
          actions: [
            { label: "Can Create Property", slug: "submit_property.can_create_property" },
          ],
        },
        {
          module: "Browse Property",
          slug: "browse_property",
          actions: [
            { label: "View Deals", slug: "browse_property.view_deals" },
            { label: "Copied Link", slug: "browse_property.copied_link" },
            // { label: "Deal Detailed", slug: "browse_property.deal_detailed" },
          ],
        },
        {
          module: "Favorite Property",
          slug: "favorite_property",
          actions: [
            { label: "Can View Favourite Property", slug: "favorite_property.can_view_favourite_property" },
          ],
        },
        {
          module: "Settings",
          slug: "settings",
          actions: [
            { label: "Manage Filters", slug: "settings.manage_filters" },
            { label: "Manage Tax Rate", slug: "settings.manage_tax_rate" },
            { label: "Manage Client Home Page", slug: "settings.manage_client_home_page" },
            { label: "Manage Client About Page", slug: "settings.manage_client_about_page" },
            { label: "Manage Submitter Home Page", slug: "settings.manage_submitter_home_page" },
            { label: "Manage Submitter About Page", slug: "settings.manage_submitter_about_page" },
          ],
        },
        {
          module: "User Management",
          slug: "user_management",
          actions: [
            { label: "All User List", slug: "user_management.user_listing", radioGroup: "user_listing" },
            { label: "Own User List", slug: "user_management.own_user_listing", radioGroup: "user_listing" },
            { label: "Edit User", slug: "user_management.edit_user" },
            { label: "Reset Password", slug: "user_management.reset_password" },
            { label: "Delete User", slug: "user_management.delete_user" },
            { label: "Add New User", slug: "user_management.add_new_user" },
          ],
        },
        {
          module: "Property Management",
          slug: "property_management",
          actions: [
            { label: "View Property Listing", slug: "property_management.view_property_listing" },
            { label: "Manage/Edit Property", slug: "property_management.manage_edit_property" },
            { label: "Approve Property", slug: "property_management.approve_property" },
            { label: "Reject Property", slug: "property_management.reject_property" },
            { label: "Delete Property", slug: "property_management.delete_property" },
            { label: "Mark As Pending Property", slug: "property_management.mark_as_pending_property" },
            { label: "Published Property", slug: "property_management.published_property" },
            { label: "Mark As Sold Property", slug: "property_management.mark_as_sold_property" },
          ],
        },
        {
          module: "Submit Property",
          slug: "submit_property",
          actions: [
            { label: "Can Create Property", slug: "submit_property.can_create_property" },
          ],
        },
        {
          module: "Browse Property",
          slug: "browse_property",
          actions: [
            { label: "View Deals", slug: "browse_property.view_deals" },
            { label: "Copied Link", slug: "browse_property.copied_link" },
            { label: "Deal Detailed", slug: "browse_property.deal_detailed" },
          ],
        },
        {
          module: "Favorite Property",
          slug: "favorite_property",
          actions: [
            { label: "Can View Favourite Property", slug: "favorite_property.can_view_favourite_property" },
          ],
        },
        {
          module: "Settings",
          slug: "settings",
          actions: [
            { label: "Manage Filters", slug: "settings.manage_filters" },
            { label: "Manage Tax Rate", slug: "settings.manage_tax_rate" },
            { label: "Manage Client Home Page", slug: "settings.manage_client_home_page" },
            { label: "Manage Client About Page", slug: "settings.manage_client_about_page" },
            { label: "Manage Submitter Home Page", slug: "settings.manage_submitter_home_page" },
            { label: "Manage Submitter About Page", slug: "settings.manage_submitter_about_page" },
          ],
        },
      ],
    },
  ],
  client_roles: [
    {
      permissions: [
        {
          module: "Browse Property",
          slug: "browse_property",
          actions: [
            { label: "Can View Browse Property", slug: "browse_property.can_view" },
            { label: "Save Buy Box Filter", slug: "browse_property.save_buybox_filter" },
            { label: "Copy Link", slug: "browse_property.copy_link" },
          ],
        },
        {
          module: "Favorite Property",
          slug: "favorite_property",
          actions: [
            { label: "Can View Favorite Property", slug: "favorite_property.can_view" },
          ],
        },
        {
          module: "My Profile",
          slug: "my_profile",
          actions: [
            { label: "Can View Profile Information", slug: "my_profile.can_view" },
            { label: "Can Modified Profile Information", slug: "my_profile.can_update" },
            { label: "Change Password", slug: "my_profile.change_password" },
          ],
        },
        {
          module: "Property Notification",
          slug: "property_notification",
          actions: [
            { label: "Can View Property Notification", slug: "property_notification.can_view" },
          ],
        },
      ]
    }
  ],
  submitter_roles: [
    {
      permissions: [
        {
          module: "Submit Property Section",
          slug: "submit_property",
          actions: [
            { label: "Create Property", slug: "submit_property.can_create" },
          ],
        },
        {
          module: "My Property",
          slug: "my_property",
          actions: [
            { label: "Can View Self Property", slug: "my_property.can_view" },
            { label: "Edit Property", slug: "my_property.can_edit" },
            { label: "Delete Property", slug: "my_property.can_delete" },
          ],
        },
        {
          module: "My Profile",
          slug: "my_profile",
          actions: [
            { label: "Can View Profile Information", slug: "my_profile.can_view" },
            { label: "Can Modified Profile Information", slug: "my_profile.can_update" },
            { label: "Change Password", slug: "my_profile.change_password" },
          ],
        },
        // {
        //   module: "Property Notification",
        //   slug: "property_notification",
        //   actions: [
        //     { label: "Can View Property Notification", slug: "property_notification.can_view" },
        //   ],
        // },
      ]
    }
  ]
};

export default rolePermissions;
