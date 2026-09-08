package com.harsha.interview_platform.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SignupRequest {

    @NotBlank
    @Email
    private String email ;

    @NotBlank
    @Size(min = 6, message = "Password at least 6 characters")
    private String password ;

    @NotBlank
    private String name ;
}
