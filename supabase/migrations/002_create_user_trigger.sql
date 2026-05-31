-- Trigger: crea restaurant + user públicos cuando un usuario se registra en auth.users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_restaurant_id UUID;
BEGIN
  INSERT INTO public.restaurants (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Mi Restaurante'))
  RETURNING id INTO new_restaurant_id;

  INSERT INTO public.users (id, restaurant_id)
  VALUES (NEW.id, new_restaurant_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
