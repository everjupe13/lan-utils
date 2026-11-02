# @nearby/shared

Публичные контракты и чистые правила проекта «Рядом». Пакет не зависит от frontend, backend, Node.js API, DOM и сторонних библиотек времени исполнения.

```ts
import type { ChatMessage } from '@nearby/shared/chat';
import type { RoomState } from '@nearby/shared/room';
import { fileNameProblem } from '@nearby/shared/file-policy';
```

Публичные точки входа: корень пакета, `chess`, `person`, `room`, `protocol`, `chat`, `files`, `file-policy`. В `exports` указаны только собранные `dist/*.js` и `dist/*.d.ts`. Импорт из `src` закрыт.

```sh
npm run build:shared     # из корня монорепозитория
npm run dev             # приложения и наблюдение за изменениями shared
npm run check:boundaries
```

`npm run build` в корне собирает shared перед приложениями. Vite включает используемые функции в клиентский бандл; Node.js загружает собранный пакет как обычную production-зависимость. В npm-архив попадает `dist`, исходники не нужны для исполнения.

Серверные модели, пути файлов на диске, состояние UI и конкретные реализации транспорта принадлежат приложениям и сюда не экспортируются.
