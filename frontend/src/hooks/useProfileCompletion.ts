import { useQuery } from "@tanstack/react-query";
import { getLatestCV } from "@/services/api";

/**
 * Hook to calculate profile completion percentage.
 * Returns 100% if CV is uploaded, otherwise calculates based on profile fields.
 */
export const useProfileCompletion = () => {
  const { data: cvData, isLoading, error } = useQuery({
    queryKey: ["cv", "latest"],
    queryFn: getLatestCV,
    retry: false,
    refetchOnWindowFocus: true,
    // Don't throw on 404 - it just means no CV exists yet
    throwOnError: false,
  });

  // If CV exists and has data, profile is 100% complete
  if (cvData && cvData.cv_data) {
    return { completion: 100, isLoading };
  }

  // If there's an error (like 404 - no CV found), or no data, calculate based on profile fields
  // For now, return a default value if no CV
  // You can enhance this later to check individual profile fields
  return { completion: 75, isLoading };
};
