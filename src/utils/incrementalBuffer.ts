import { pipe, of, empty } from "rxjs";
import { flatMap } from "rxjs/operators";

type Options = {
  maxItems: number;
  minItems?: number;
  incrementCountBy: number;
};

export function incrementalBuffer({
  maxItems,
  minItems,
  incrementCountBy
}: Options) {
  let buffer: Array<any> = [];
  let emitCountdown = minItems || incrementCountBy;

  return pipe(
    flatMap(item => {
      buffer.push(item);
      emitCountdown--;

      if (emitCountdown === 0) {
        emitCountdown = incrementCountBy;
        buffer = buffer.slice(-maxItems);
        return of(buffer);
      }

      return empty();
    })
  );
}