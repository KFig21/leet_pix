import { AVATAR_ICONS, AVATAR_SHAPES } from "@leetpix/shared";
import type { Avatar as AvatarData } from "@leetpix/shared";
import { Avatar } from "@/components/Avatar/Avatar";
import { AVATAR_ICONS as ICON_COMPONENTS } from "@/components/Avatar/icons";
import "./AvatarEditor.scss";

interface Props {
  value: AvatarData;
  onChange: (next: AvatarData) => void;
}

// Curated foreground emoji (a full keyboard is overkill and off-brand).
const EMOJIS = [
  "🏈", "⚾", "🏀", "⚽", "🏒", "🎾", "🏐", "🏉",
  "🥎", "🥏", "🏆", "🥇", "🔥", "⭐️", "💪", "🐐",
  "🚀", "🎯", "🧢", "🦅", "🐻", "🐯", "🦁", "🐺",
];

const BG_PRESETS = [
  "#2fa84f", "#1d9bf0", "#e0245e", "#f5a623",
  "#8e44ad", "#16a085", "#0f1419", "#536471",
];
const ICON_COLOR_PRESETS = ["#ffffff", "#000000", "#2fa84f", "#f5a623", "#1d9bf0"];

const SHAPE_LABEL: Record<(typeof AVATAR_SHAPES)[number], string> = {
  circle: "Circle",
  rounded: "Rounded",
  square: "Square",
};

export function AvatarEditor({ value, onChange }: Props) {
  const mode: "icon" | "emoji" = value.emoji ? "emoji" : "icon";
  const set = (patch: Partial<AvatarData>) => onChange({ ...value, ...patch });

  const useIconMode = () =>
    set({ emoji: undefined, icon: value.icon ?? "football", iconColor: value.iconColor ?? "#ffffff" });
  const useEmojiMode = () => set({ icon: undefined, emoji: value.emoji ?? "🏈" });

  return (
    <div className="avatar-editor">
      <div className="avatar-editor__preview">
        <Avatar avatar={value} size={96} />
      </div>

      {/* Foreground mode */}
      <div className="avatar-editor__tabs">
        <button
          type="button"
          className={`avatar-editor__tab${mode === "icon" ? " avatar-editor__tab--active" : ""}`}
          onClick={useIconMode}
        >
          Sport icon
        </button>
        <button
          type="button"
          className={`avatar-editor__tab${mode === "emoji" ? " avatar-editor__tab--active" : ""}`}
          onClick={useEmojiMode}
        >
          Emoji
        </button>
      </div>

      {mode === "icon" ? (
        <>
          <div className="avatar-editor__grid">
            {AVATAR_ICONS.map((key) => {
              const Icon = ICON_COMPONENTS[key];
              return (
                <button
                  type="button"
                  key={key}
                  className={`avatar-editor__cell${value.icon === key ? " avatar-editor__cell--active" : ""}`}
                  onClick={() => set({ icon: key, emoji: undefined })}
                  aria-label={key}
                >
                  <Icon />
                </button>
              );
            })}
          </div>

          <label className="avatar-editor__label">Icon color</label>
          <ColorRow
            value={value.iconColor ?? "#ffffff"}
            presets={ICON_COLOR_PRESETS}
            onChange={(iconColor) => set({ iconColor })}
          />
        </>
      ) : (
        <div className="avatar-editor__grid">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              className={`avatar-editor__cell${value.emoji === e ? " avatar-editor__cell--active" : ""}`}
              onClick={() => set({ emoji: e, icon: undefined })}
            >
              <span className="avatar-editor__emoji">{e}</span>
            </button>
          ))}
        </div>
      )}

      <label className="avatar-editor__label">Background</label>
      <ColorRow
        value={value.bgColor}
        presets={BG_PRESETS}
        onChange={(bgColor) => set({ bgColor })}
      />

      <label className="avatar-editor__label">Shape</label>
      <div className="avatar-editor__shapes">
        {AVATAR_SHAPES.map((shape) => (
          <button
            type="button"
            key={shape}
            className={`avatar-editor__shape${value.shape === shape ? " avatar-editor__shape--active" : ""}`}
            onClick={() => set({ shape })}
          >
            <Avatar avatar={{ ...value, shape }} size={36} />
            {SHAPE_LABEL[shape]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Preset swatches + a native color input for anything custom.
function ColorRow({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: string[];
  onChange: (c: string) => void;
}) {
  return (
    <div className="avatar-editor__colors">
      {presets.map((c) => (
        <button
          type="button"
          key={c}
          className={`avatar-editor__swatch${value.toLowerCase() === c.toLowerCase() ? " avatar-editor__swatch--active" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      <input
        type="color"
        className="avatar-editor__native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Custom color"
      />
    </div>
  );
}
