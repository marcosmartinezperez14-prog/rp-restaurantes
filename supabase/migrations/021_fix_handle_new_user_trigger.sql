-- Migracion 021: corrige el trigger handle_new_user
-- Anade slug y nif al insert de restaurants, y auth_id/email/nombre al insert de users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  new_restaurant_id UUID;
  base_slug TEXT;
BEGIN
  base_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'restaurante'),
    '[^a-z0-9]+', '-', 'g'
  ));

  INSERT INTO public.restaurants (name, slug, nif)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Mi Restaurante'),
    base_slug || '-' || substr(NEW.id::text, 1, 8),
    COALESCE(NEW.raw_user_meta_data->>'nif', 'PENDIENTE')
  )
  RETURNING id INTO new_restaurant_id;

  INSERT INTO public.users (id, auth_id, restaurant_id, email, nombre)
  VALUES (
    NEW.id,
    NEW.id,
    new_restaurant_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'username', 'Usuario')
  );

  RETURN NEW;
END;
$func$;
