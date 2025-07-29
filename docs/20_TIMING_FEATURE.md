# Menu Item Timing Feature

This document describes the timing feature for menu items that allows restaurants to specify when items are available.

## Overview

The timing feature allows menu items to have availability windows, ensuring customers only see items that are currently available based on the time of day.

## Database Schema

### MenuItem Model
```python
# Daily timing (for backward compatibility)
timing_start = Column(Time, nullable=True)  # When item becomes available
timing_end = Column(Time, nullable=True)    # When item becomes unavailable

# Weekly schedule (for future extension)
timing_schedule = Column(JSON, nullable=True)  # Weekly schedule with different timing per day
```

## CSV Format

When onboarding restaurants, you can include timing data in the menu CSV:

```csv
id,name,description,price,veg_flag,timing_start,timing_end
1,Breakfast Burrito,Scrambled eggs,12.99,false,06:00,11:00
2,Lunch Special,Grilled chicken,15.99,false,11:00,15:00
3,Dinner Steak,Prime ribeye,28.99,false,17:00,22:00
4,Late Night Pizza,Pepperoni pizza,18.99,false,22:00,02:00
5,All Day Coffee,Hot coffee,4.99,true,,,
```

### Timing Format Rules

- **Format**: 24-hour clock (HH:MM)
- **Examples**: "09:00", "14:30", "22:00"
- **Null/Empty**: Item available all day
- **Overnight**: Use "22:00" to "06:00" for overnight availability

## API Response Format

### Daily Timing
```json
{
  "id": "item-123",
  "name": "Breakfast Burrito",
  "timing": {
    "start": "06:00",
    "end": "11:00"
  }
}
```

### Weekly Timing (Future)
```json
{
  "id": "item-123",
  "name": "Weekend Brunch",
  "timing": {
    "monday": {"start": "09:00", "end": "17:00"},
    "tuesday": {"start": "09:00", "end": "17:00"},
    "wednesday": {"start": "09:00", "end": "17:00"},
    "thursday": {"start": "09:00", "end": "17:00"},
    "friday": {"start": "09:00", "end": "22:00"},
    "saturday": {"start": "10:00", "end": "22:00"},
    "sunday": {"start": "10:00", "end": "18:00"}
  }
}
```

### No Timing
```json
{
  "id": "item-123",
  "name": "All Day Coffee",
  "timing": null
}
```

## Frontend Implementation

### useMenu Hook
The `useMenu` hook automatically filters items based on current time:

```javascript
const { data: menu } = useMenu({
  includeTiming: true  // Default: true
});
```

### Timing Logic

1. **No timing**: Item always available
2. **Daily timing**: Check if current time is within start/end range
3. **Overnight timing**: Handle cases like "22:00" to "06:00"
4. **Weekly timing**: Check current day and time

### Examples

- **6:00 AM**: Only "Breakfast Burrito" and "All Day Coffee" available
- **12:00 PM**: "Lunch Special" and "All Day Coffee" available
- **8:00 PM**: "Dinner Steak" and "All Day Coffee" available
- **11:00 PM**: "Late Night Pizza" and "All Day Coffee" available

## Migration

Existing menu items will have `timing: null` in the API response, meaning they're available all day.

## Future Enhancements

1. **Weekly schedules**: Different timing per day of the week
2. **Holiday schedules**: Special timing for holidays
3. **Seasonal items**: Items only available during certain seasons
4. **Admin interface**: Web interface to manage timing without CSV 