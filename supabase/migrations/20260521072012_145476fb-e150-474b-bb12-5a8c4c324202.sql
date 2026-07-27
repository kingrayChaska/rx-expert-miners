

-- Clean up orphaned profile/role rows whose auth user no longer exists
DELETE FROM public.user_roles ur
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id);

DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

-- Backfill again for any current auth.users now that orphans are gone
INSERT INTO public.profiles (user_id, email, display_name, is_approved)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'display_name', u.email),
       NOT EXISTS (SELECT 1 FROM public.profiles)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
       CASE WHEN (SELECT COUNT(*) FROM public.user_roles) = 0 THEN 'owner'::app_role
            ELSE 'user'::app_role END
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

