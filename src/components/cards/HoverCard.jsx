import { buildAtomInfoFields, formatFieldLabel, translateDisplayValue } from '../../utils/format.js';

export function HoverCard({ atom, position, language }) {
  const infoFields = buildAtomInfoFields(atom, language);

  if (!atom || !infoFields.length || !position) {
    return null;
  }

  return (
    <aside
      className="hover-card"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="hover-card__header">
        <div className="hover-card__title-wrap">
          <strong className="hover-card__title">{atom.label}</strong>
        </div>
      </div>

      <div className="hover-card__list">
        {infoFields.map((field, index) => (
          <div className="hover-card__row" key={`${atom.id}-${field.label}-${index}`}>
            <span className="hover-card__label">{formatFieldLabel(field.label, language)}</span>
            <span className="hover-card__value">{translateDisplayValue(field.value, language)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
