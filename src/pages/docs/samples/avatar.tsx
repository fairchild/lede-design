import { Avatar } from '@/components/lede/avatar';

export function Author({ name, picture }: { name: string; picture?: string }) {
  return (
    <p>
      {/* The name is beside it, so the picture's alt is empty. */}
      <Avatar name={name} src={picture} alt="" /> {name}
    </p>
  );
}
