import type { ImageSourcePropType } from 'react-native';
import type { Service } from '../../../core/domain/service';

/**
 * Get appropriate image for each service based on service ID and category
 * Uses high-quality images from Unsplash and other sources
 */
export function getServiceImageSource(service: Pick<Service, 'id' | 'category' | 'imageKey'>): { uri: string } | ImageSourcePropType {
  const normalizedCategory = String(service.category ?? '').trim().toUpperCase();
  const isBirthCategory =
    normalizedCategory === 'BIRTH' ||
    normalizedCategory.includes('BIRTH') ||
    String(service.category ?? '').includes('ولادة');
  const isMarriageDivorceCategory =
    normalizedCategory === 'MARRIAGE_DIVORCE' ||
    normalizedCategory.includes('MARRIAGE') ||
    normalizedCategory.includes('DIVORCE') ||
    String(service.category ?? '').includes('زواج') ||
    String(service.category ?? '').includes('طلاق');
  const isAddressCategory =
    normalizedCategory === 'ADDRESS' ||
    normalizedCategory === 'RESIDENCE_ADDRESS' ||
    normalizedCategory.includes('ADDRESS') ||
    normalizedCategory.includes('RESIDENCE') ||
    String(service.category ?? '').includes('عنوان السكن') ||
    String(service.category ?? '').includes('السكن');
  const isFamilyReunificationCategory =
    normalizedCategory === 'FAMILY_REUNIFICATION' ||
    normalizedCategory.includes('REUNIFICATION') ||
    normalizedCategory.includes('FAMILY') ||
    String(service.category ?? '').includes('جمع الشمل');
  const isCitizenshipRestorationCategory =
    normalizedCategory === 'CITIZENSHIP_RESTORATION' ||
    normalizedCategory.includes('CITIZENSHIP') ||
    normalizedCategory.includes('RESTORATION') ||
    String(service.category ?? '').includes('اعادة مواطنة') ||
    String(service.category ?? '').includes('إعادة مواطنة');
  const isLicensesCategory =
    normalizedCategory === 'LICENSES' ||
    normalizedCategory === 'LICENCES' ||
    normalizedCategory.includes('LICENSE') ||
    normalizedCategory.includes('LICENCE') ||
    String(service.category ?? '').includes('الرخص') ||
    String(service.category ?? '').includes('رخص');
  const isPassportCategory =
    normalizedCategory === 'PASSPORT' ||
    normalizedCategory.includes('PASSPORT') ||
    String(service.category ?? '').includes('جواز') ||
    String(service.category ?? '').includes('جواز السفر');
  const isDrivingLicenseCategory =
    normalizedCategory === 'DRIVING_LICENSE' ||
    normalizedCategory.includes('DRIVING') ||
    String(service.category ?? '').includes('رخص السياقة') ||
    String(service.category ?? '').includes('رخصة السياقة') ||
    String(service.category ?? '').includes('سياقة');
  const isIdentityCategory =
    normalizedCategory === 'IDENTITY' ||
    normalizedCategory.includes('IDENTITY') ||
    String(service.category ?? '').includes('الهوية');

  // Any service in driving license category uses a dedicated image.
  if (isDrivingLicenseCategory) {
    return require('../../../../assets/services/driving-license-category.png');
  }

  // Any service in passport category uses a shared image.
  if (isPassportCategory) {
    return require('../../../../assets/services/passport-category.png');
  }

  // Any service in licenses category uses a shared image.
  if (isLicensesCategory) {
    return require('../../../../assets/services/licenses-category.png');
  }

  // Any service in citizenship restoration category uses a shared image.
  if (isCitizenshipRestorationCategory) {
    return require('../../../../assets/services/citizenship-restoration-category.png');
  }

  // Any service in family reunification category uses a shared image.
  if (isFamilyReunificationCategory) {
    return require('../../../../assets/services/family-reunification-category.png');
  }

  // Any service in residence address category uses a shared image.
  if (isAddressCategory) {
    return require('../../../../assets/services/address-category.png');
  }

  // Any service in marriage/divorce category uses a shared image.
  if (isMarriageDivorceCategory) {
    return require('../../../../assets/services/marriage-divorce-category.png');
  }

  // Any service in birth category uses a shared birth image.
  if (isBirthCategory) {
    return require('../../../../assets/services/birth-category.png');
  }

  // Any service in identity category uses a shared category image.
  if (isIdentityCategory) {
    return require('../../../../assets/services/identity-category.png');
  }

  // Service-specific images
  switch (service.id) {
    case 'svc_birth_cert':
      // Birth certificate service uses dedicated birth image.
      return require('../../../../assets/services/birth-category.png');

    case 'svc_renew_id':
      // National ID renewal - ID card image
      return { uri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop' };
    
    case 'svc_passport_renew':
      // Passport renewal - Palestinian passport image
      return { uri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop' };
    
    case 'svc_vehicle_reg':
      // Vehicle registration - car image
      return { uri: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop' };
    
    case 'svc_driver_license_renew':
      // Driver license - license/driving image
      return { uri: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&h=300&fit=crop' };
    
    case 'svc_parking_permit':
      // Parking permit - parking/city image
      return { uri: 'https://images.unsplash.com/photo-1449824913935-9a10bd0e0871?w=400&h=300&fit=crop' };
    
    default:
      // Fallback to category-based images
      switch (service.category) {
        case 'IDENTITY':
          return { uri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop' };
        case 'TRANSPORT':
          return { uri: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=300&fit=crop' };
        case 'PERMITS':
          return { uri: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&h=300&fit=crop' };
        default:
          return { uri: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop' };
      }
  }
}
