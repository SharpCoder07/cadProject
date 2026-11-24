import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * zodResolver typed for schemas with defaults/transforms: the form holds the
 * schema's *input* type and handleSubmit receives its parsed *output* type.
 */
export const formResolver = <S extends z.ZodTypeAny>(schema: S) =>
  zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>;
