import type { ComponentPropsWithoutRef, ComponentType, SVGProps } from "react";
import { Button } from "./Button";

type IconButtonProps = Omit<ComponentPropsWithoutRef<typeof Button>, "children" | "size"> & {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconSize?: number;
};

export function IconButton({ icon: Icon, iconSize = 16, ...props }: IconButtonProps) {
  return (
    <Button size="icon" {...props}>
      <Icon width={iconSize} height={iconSize} aria-hidden="true" focusable="false" />
    </Button>
  );
}
